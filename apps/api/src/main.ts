import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

import {
  activateSellerRaffle,
  approveSellerOrder,
  attachPaymentProofToOrder,
  blockSellerRaffleNumberByValue,
  createManualSellerOrder,
  createSellerDeliveryGalleryImage,
  createPublicOrderForRaffle,
  createSellerRaffle,
  createSellerRafflePrize,
  deleteSellerDeliveryGalleryImage,
  deleteSellerRafflePrize,
  ensureLocalSchema,
  getPublicActiveRaffleBySlug,
  getPublicCurrentActiveRaffle,
  getPublicDrawResultBySlug,
  getPublicOrderStatus,
  getPublicRaffleStatsBySlug,
  getPublicWinnersContentBySlug,
  getLocalDatabaseHealth,
  getCustomerDetail,
  getSellerActiveRaffle,
  getSellerDrawResult,
  getSellerSettings,
  getSellerOrderDetail,
  getSellerRaffleById,
  listPublicRaffleNumbersBySlug,
  listSellerAuditLogs,
  listSellerCustomers,
  listSellerNotificationLogs,
  listSellerOrders,
  listSellerDeliveryGallery,
  listSellerRaffleNumbers,
  listSellerRaffleOrdersForExport,
  listSellerRafflePrizes,
  listSellerRaffles,
  listSellerWinners,
  persistCampaignAssetImage,
  persistCampaignCoverImage,
  persistCampaignPaymentQrImage,
  registerSellerDrawResult,
  rejectSellerOrder,
  releaseSellerRaffleNumber,
  upsertNotificationLog,
  updateSellerRaffle,
  updateSellerDefaultPaymentQrImage,
  updateSellerDeliveryGalleryImage,
  updateSellerSettings,
  updateSellerRaffleCoverImage,
  updateSellerRafflePaymentQrImage,
  updateSellerRafflePrize,
  updateSellerWinner,
  createRifaDatabase,
} from '@rifa/db';
import { NOTIFICATION_CHANNELS, NOTIFICATION_JOB_STATUSES, NOTIFICATION_TYPES } from '@rifa/shared';
import {
  createAdminRaffleSchema,
  createManualOrderSchema,
  createGalleryImageSchema,
  createPrizeSchema,
  createPublicOrderSchema,
  registerDrawResultSchema,
  rejectAdminOrderSchema,
  updateAdminRaffleSchema,
  updateGalleryImageSchema,
  updatePrizeSchema,
  updateWinnerSchema,
  sellerSettingsSchema,
  uploadCampaignImageSchema,
  uploadPaymentProofSchema,
} from '@rifa/validation';
import { broadcastToSeller, registerSseClient } from './sse-bus';
import nodemailer from 'nodemailer';
import sharp from 'sharp';

interface ApiHealthResponse {
  readonly service: string;
  readonly status: 'ok';
  readonly timestamp: string;
}

interface DatabaseHealthSuccessResponse {
  readonly ok: true;
  readonly driver: 'pglite' | 'postgresql';
  readonly sellersCount: number;
  readonly timestamp: string;
}

interface DatabaseHealthFailureResponse {
  readonly ok: false;
  readonly driver: 'pglite' | 'postgresql' | 'unknown';
  readonly error: string;
  readonly timestamp: string;
}

interface ErrorResponse {
  readonly error: string;
  readonly message?: string;
  readonly details?: unknown;
}

interface AdminContext {
  readonly sellerId: string;
}

interface ManualOrderProof {
  readonly proofUrl: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

interface TelegramInlineKeyboardButton {
  readonly text: string;
  readonly url: string;
}

interface TelegramInlineKeyboardRow {
  readonly buttons: readonly TelegramInlineKeyboardButton[];
}

interface TelegramReplyMarkup {
  readonly inlineKeyboard: readonly TelegramInlineKeyboardRow[];
}

const ADMIN_ROLES = {
  admin: 'admin',
} as const;

type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

interface AdminTokenPayload {
  readonly sub: string;
  readonly sellerId: string;
  readonly role: AdminRole;
  readonly exp: number;
}

type JsonResponse = unknown;

const API_DEV_TOKEN = process.env.API_DEV_TOKEN ?? 'dev-local-token';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? undefined : '123456789ui');
const ADMIN_SELLER_ID = process.env.ADMIN_SELLER_ID ?? 'seller_demo';
const JWT_SECRET =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-rifa-jwt-secret');
const ADMIN_JWT_TTL_SECONDS = Number(process.env.ADMIN_JWT_TTL_SECONDS ?? 60 * 60 * 8);
const PROOF_STORAGE_DIR = process.env.PROOF_STORAGE_DIR ?? './packages/db/proofs';
const CAMPAIGN_ASSETS_DIR = process.env.CAMPAIGN_ASSETS_DIR ?? './packages/db/campaign-assets';
const COMPRESSED_PROOF_MIME_TYPE = 'image/webp';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SELLER_CHAT_ID = process.env.TELEGRAM_SELLER_CHAT_ID;
const DEFAULT_EMAIL_FROM = 'La Bella MJ <noreply@labellamj.com>';
const DEFAULT_SMTP_HOST = 'smtp-mail.outlook.com';
const DEFAULT_SMTP_PORT = 587;
const EMAIL_FROM = process.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;
const ADMIN_WEB_URL = process.env.ADMIN_WEB_URL ?? 'http://localhost:5174';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';
const SMTP_HOST = process.env.SMTP_HOST ?? DEFAULT_SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? DEFAULT_SMTP_PORT);
const SMTP_SECURE = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER ?? DEFAULT_EMAIL_FROM;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

const toSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

const buildAdminOrderUrl = (orderId: string): string => {
  const baseUrl = ADMIN_WEB_URL.trim() || 'http://localhost:5174';

  try {
    const url = new URL('/orders', baseUrl);
    url.searchParams.set('orderId', orderId);

    return url.toString();
  } catch {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

    return `${normalizedBaseUrl}/orders?orderId=${encodeURIComponent(orderId)}`;
  }
};

const toTelegramReplyMarkup = (
  replyMarkup: TelegramReplyMarkup | undefined,
): { readonly inline_keyboard: readonly (readonly TelegramInlineKeyboardButton[])[] } | undefined => {
  if (!replyMarkup) {
    return undefined;
  }

  return {
    inline_keyboard: replyMarkup.inlineKeyboard.map((row) => row.buttons),
  };
};

const sendJson = (response: ServerResponse, statusCode: number, body: JsonResponse): void => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-api-key, x-seller-id',
  });
  response.end(JSON.stringify(body));
};

const sendText = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void => {
  const payload = Buffer.from(body, 'utf8');
  response.writeHead(statusCode, {
    'content-type': contentType,
    'content-length': payload.byteLength,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-api-key, x-seller-id',
  });
  response.end(payload);
};

const sendBinary = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
): void => {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'content-length': body.byteLength,
    'cache-control': 'private, max-age=60',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-api-key, x-seller-id',
  });
  response.end(body);
};

const getHeader = (request: IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as unknown;
};

const toBase64Url = (input: string | Buffer): string =>
  Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const fromBase64Url = (input: string): string => {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  return Buffer.from(padded, 'base64').toString('utf8');
};

const secureEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const signAdminToken = (payload: AdminTokenPayload): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required for admin login.');
  }

  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
};

const isAdminTokenPayload = (value: unknown): value is AdminTokenPayload =>
  typeof value === 'object' &&
  value !== null &&
  'sub' in value &&
  typeof value.sub === 'string' &&
  'sellerId' in value &&
  typeof value.sellerId === 'string' &&
  'role' in value &&
  value.role === ADMIN_ROLES.admin &&
  'exp' in value &&
  typeof value.exp === 'number';

const verifyAdminToken = (token: string): AdminTokenPayload | undefined => {
  if (!JWT_SECRET) {
    return undefined;
  }

  const [header, body, signature] = token.split('.');

  if (!header || !body || !signature) {
    return undefined;
  }

  const expectedSignature = toBase64Url(
    createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest(),
  );

  if (!secureEquals(signature, expectedSignature)) {
    return undefined;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(fromBase64Url(body)) as unknown;
  } catch {
    return undefined;
  }

  if (!isAdminTokenPayload(payload)) {
    return undefined;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return undefined;
  }

  return payload;
};

const getBearerToken = (request: IncomingMessage): string | undefined => {
  const authorization = getHeader(request, 'authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorization.slice('Bearer '.length).trim();
};

const decodeBase64Image = (dataBase64: string): Buffer => {
  const [, base64Body = dataBase64] = dataBase64.match(/^data:[^;]+;base64,(.*)$/) ?? [];

  return Buffer.from(base64Body, 'base64');
};

const compressPaymentProof = async (input: Buffer): Promise<Buffer> =>
  sharp(input, { limitInputPixels: 16_000_000 })
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 45, effort: 6 })
    .toBuffer();

const compressCampaignCover = async (
  input: Buffer,
  mimeType: string,
): Promise<{ readonly buffer: Buffer; readonly mimeType: string }> => {
  const pipeline = sharp(input, { limitInputPixels: 16_000_000 }).rotate().resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (mimeType === 'image/png') {
    return {
      buffer: await pipeline.png({ quality: 82 }).toBuffer(),
      mimeType: 'image/png',
    };
  }

  if (mimeType === 'image/webp') {
    return {
      buffer: await pipeline.webp({ quality: 82 }).toBuffer(),
      mimeType: 'image/webp',
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 82 }).toBuffer(),
    mimeType: 'image/jpeg',
  };
};

const BACKGROUND_SAMPLE_SIZE = 24;
const BACKGROUND_UNIFORM_DISTANCE = 42;
const BACKGROUND_TRANSPARENT_DISTANCE = 32;
const BACKGROUND_FEATHER_DISTANCE = 78;
const BACKGROUND_MIN_LIGHTNESS = 185;

interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const getPixelOffset = (x: number, y: number, width: number, channels: number): number =>
  (y * width + x) * channels;

const getColorDistance = (left: RgbColor, right: RgbColor): number => {
  const redDelta = left.red - right.red;
  const greenDelta = left.green - right.green;
  const blueDelta = left.blue - right.blue;

  return Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta);
};

const getLightness = (color: RgbColor): number =>
  color.red * 0.2126 + color.green * 0.7152 + color.blue * 0.0722;

const getAverageCornerColor = (
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  startX: number,
  startY: number,
): RgbColor => {
  const sampleWidth = Math.min(BACKGROUND_SAMPLE_SIZE, width);
  const sampleHeight = Math.min(BACKGROUND_SAMPLE_SIZE, height);
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;

  for (let y = startY; y < startY + sampleHeight; y += 1) {
    for (let x = startX; x < startX + sampleWidth; x += 1) {
      const offset = getPixelOffset(x, y, width, channels);
      const alpha = data[offset + 3] ?? 255;

      if (alpha < 16) {
        continue;
      }

      red += data[offset] ?? 0;
      green += data[offset + 1] ?? 0;
      blue += data[offset + 2] ?? 0;
      samples += 1;
    }
  }

  if (samples === 0) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: red / samples,
    green: green / samples,
    blue: blue / samples,
  };
};

const getDetectedBackgroundColor = (
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): RgbColor | undefined => {
  const sampleWidth = Math.min(BACKGROUND_SAMPLE_SIZE, width);
  const sampleHeight = Math.min(BACKGROUND_SAMPLE_SIZE, height);
  const corners = [
    getAverageCornerColor(data, width, height, channels, 0, 0),
    getAverageCornerColor(data, width, height, channels, width - sampleWidth, 0),
    getAverageCornerColor(data, width, height, channels, 0, height - sampleHeight),
    getAverageCornerColor(
      data,
      width,
      height,
      channels,
      width - sampleWidth,
      height - sampleHeight,
    ),
  ];

  const background = {
    red: corners.reduce((sum, color) => sum + color.red, 0) / corners.length,
    green: corners.reduce((sum, color) => sum + color.green, 0) / corners.length,
    blue: corners.reduce((sum, color) => sum + color.blue, 0) / corners.length,
  };
  const isUniform = corners.every(
    (corner) => getColorDistance(corner, background) <= BACKGROUND_UNIFORM_DISTANCE,
  );

  if (!isUniform || getLightness(background) < BACKGROUND_MIN_LIGHTNESS) {
    return undefined;
  }

  return background;
};

const removeLightBackgroundFromCampaignCover = async (input: Buffer): Promise<Buffer> => {
  const { data, info } = await sharp(input, { limitInputPixels: 16_000_000 })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = getDetectedBackgroundColor(data, info.width, info.height, info.channels);

  if (!background) {
    return sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
      .png({ quality: 92, compressionLevel: 9 })
      .toBuffer();
  }

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const current = {
      red: data[offset] ?? 0,
      green: data[offset + 1] ?? 0,
      blue: data[offset + 2] ?? 0,
    };
    const distance = getColorDistance(current, background);

    if (distance <= BACKGROUND_TRANSPARENT_DISTANCE) {
      data[offset + 3] = 0;
      continue;
    }

    if (distance <= BACKGROUND_FEATHER_DISTANCE) {
      const alphaRatio =
        (distance - BACKGROUND_TRANSPARENT_DISTANCE) /
        (BACKGROUND_FEATHER_DISTANCE - BACKGROUND_TRANSPARENT_DISTANCE);
      const currentAlpha = data[offset + 3] ?? 255;
      data[offset + 3] = Math.min(255, Math.round(currentAlpha * alphaRatio));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png({ quality: 92, compressionLevel: 9 })
    .toBuffer();
};

const isConfiguredSecret = (value: string | undefined): value is string => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  return !trimmed.toLowerCase().includes('change-me');
};

const toTelegramProviderMessageId = (body: unknown): string | undefined => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'result' in body &&
    typeof body.result === 'object' &&
    body.result !== null &&
    'message_id' in body.result
  ) {
    const messageId = body.result.message_id;

    return typeof messageId === 'number' || typeof messageId === 'string'
      ? String(messageId)
      : undefined;
  }

  return undefined;
};

const sendTelegramMessage = async ({
  token,
  chatId,
  text,
  replyMarkup,
}: {
  readonly token: string;
  readonly chatId: string;
  readonly text: string;
  readonly replyMarkup?: TelegramReplyMarkup;
}): Promise<string | undefined> => {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      reply_markup: toTelegramReplyMarkup(replyMarkup),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
  }

  return toTelegramProviderMessageId(body);
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getEmailConfigurationError = (): string | undefined => {
  if (isConfiguredSecret(RESEND_API_KEY)) {
    return undefined;
  }

  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT <= 0) {
    return 'SMTP_PORT is missing or invalid; email dispatch skipped.';
  }

  if (!isConfiguredSecret(SMTP_HOST)) {
    return 'SMTP_HOST is missing or contains a placeholder; email dispatch skipped.';
  }

  if (!isConfiguredSecret(SMTP_USER)) {
    return 'SMTP_USER is missing or contains a placeholder; email dispatch skipped.';
  }

  if (!isConfiguredSecret(SMTP_PASSWORD)) {
    return 'SMTP_PASSWORD is missing or contains a placeholder; email dispatch skipped.';
  }

  return undefined;
};

const sendBuyerOrderEmailWithResend = async ({
  to,
  subject,
  text,
  html,
}: {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}): Promise<string | undefined> => {
  if (!isConfiguredSecret(RESEND_API_KEY)) {
    return undefined;
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new Error(`Resend email dispatch failed with HTTP ${response.status}`);
  }

  if (typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string') {
    return body.id;
  }

  return undefined;
};

const buildBuyerOrderEmailContent = (
  detail: NonNullable<Awaited<ReturnType<typeof getSellerOrderDetail>>>,
  type: typeof NOTIFICATION_TYPES.orderApproved | typeof NOTIFICATION_TYPES.orderRejected,
): { readonly subject: string; readonly text: string; readonly html: string } => {
  const raffleTitle = detail.raffle.title;
  const orderId = detail.order.id;
  const customerName = detail.customer.fullName;
  const greeting = `Hola ${customerName},`;

  const orderedNumbers = detail.numbers
    .map((item) => item.displayNumber)
    .sort();
  const numbersLine = orderedNumbers.length > 0
    ? `Números: ${orderedNumbers.join(', ')}`
    : '';

  if (type === NOTIFICATION_TYPES.orderApproved) {
    const subject = `Pago aprobado - ${raffleTitle}`;
    const text = [
      greeting,
      '',
      `Tu pago y orden fueron aprobados para la rifa "${raffleTitle}".`,
      `ID de orden: ${orderId}`,
      ...(numbersLine ? ['', numbersLine] : []),
      '',
      'Gracias por participar. Conserva este correo como confirmación.',
    ].join('\n');
    const htmlNumbers = numbersLine
      ? `<p>Tus números: <strong>${escapeHtml(orderedNumbers.join(', '))}</strong></p>`
      : '';
    const html = `<p>${escapeHtml(greeting)}</p><p>Tu pago y orden fueron <strong>aprobados</strong> para la rifa <strong>${escapeHtml(raffleTitle)}</strong>.</p><p>ID de orden: <strong>${escapeHtml(orderId)}</strong></p>${htmlNumbers}<p>Gracias por participar. Conserva este correo como confirmación.</p>`;

    return { subject, text, html };
  }

  const rejectionReason = detail.order.rejectionReason?.trim();
  const reasonLine = rejectionReason ? `Motivo: ${rejectionReason}` : undefined;
  const subject = `Pago rechazado - ${raffleTitle}`;
  const text = [
    greeting,
    '',
    `Tu pago u orden para la rifa "${raffleTitle}" fue rechazado.`,
    `ID de orden: ${orderId}`,
    ...(reasonLine ? ['', reasonLine] : []),
    '',
    'Si crees que esto fue un error, contacta al vendedor para revisar tu comprobante.',
  ].join('\n');
  const htmlReason = rejectionReason
    ? `<p>Motivo: <strong>${escapeHtml(rejectionReason)}</strong></p>`
    : '';
  const html = `<p>${escapeHtml(greeting)}</p><p>Tu pago u orden para la rifa <strong>${escapeHtml(raffleTitle)}</strong> fue <strong>rechazado</strong>.</p><p>ID de orden: <strong>${escapeHtml(orderId)}</strong></p>${htmlReason}<p>Si crees que esto fue un error, contacta al vendedor para revisar tu comprobante.</p>`;

  return { subject, text, html };
};

const sendBuyerOrderEmail = async ({
  to,
  subject,
  text,
  html,
}: {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}): Promise<string | undefined> => {
  const resendMessageId = await sendBuyerOrderEmailWithResend({ to, subject, text, html });

  if (resendMessageId) {
    return resendMessageId;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  const result = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return typeof result.messageId === 'string' ? result.messageId : undefined;
};

const notifySellerPaymentProofUploaded = async ({
  sellerId,
  orderId,
  raffleId,
}: {
  readonly sellerId: string;
  readonly orderId: string;
  readonly raffleId: string;
}): Promise<void> => {
  const idempotencyKey = `telegram:${NOTIFICATION_TYPES.orderPendingReview}:${orderId}`;
  const recipient = isConfiguredSecret(TELEGRAM_SELLER_CHAT_ID)
    ? TELEGRAM_SELLER_CHAT_ID
    : 'telegram:unconfigured';
  const detail = await getSellerOrderDetail({ sellerId, orderId });
  const adminOrderUrl = buildAdminOrderUrl(orderId);
  const orderTotal = detail ? `${detail.order.amount} ${detail.order.currency}` : 'por revisar';
  const customerLine = detail
    ? `${detail.customer.fullName} (${detail.customer.phone})`
    : 'Cliente por revisar';
  const raffleTitle = detail?.raffle.title ?? raffleId;
  const payload = {
    orderId,
    raffleId,
    adminOrderUrl,
    event: 'payment_proof_uploaded',
    message: [
      '🧾 Nueva compra con comprobante pendiente',
      '',
      `Cliente: ${customerLine}`,
      `Campaña: ${raffleTitle}`,
      `Orden: ${orderId}`,
      `Monto: ${orderTotal}`,
      '',
      'Revisa el comprobante en el admin para aprobar o rechazar la compra.',
      adminOrderUrl,
    ].join('\n'),
  };

  try {
    if (!isConfiguredSecret(TELEGRAM_BOT_TOKEN) || !isConfiguredSecret(TELEGRAM_SELLER_CHAT_ID)) {
      await upsertNotificationLog({
        sellerId,
        orderId,
        raffleId,
        channel: NOTIFICATION_CHANNELS.telegram,
        type: NOTIFICATION_TYPES.orderPendingReview,
        recipient,
        status: NOTIFICATION_JOB_STATUSES.failed,
        payload,
        idempotencyKey,
        errorMessage:
          'Telegram configuration is missing or contains a placeholder; dispatch skipped.',
      });
      return;
    }

    const providerMessageId = await sendTelegramMessage({
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_SELLER_CHAT_ID,
      text: payload.message,
      replyMarkup: {
        inlineKeyboard: [
          {
            buttons: [
              {
                text: 'Revisar compra en admin',
                url: adminOrderUrl,
              },
            ],
          },
        ],
      },
    });

    await upsertNotificationLog({
      sellerId,
      orderId,
      raffleId,
      channel: NOTIFICATION_CHANNELS.telegram,
      type: NOTIFICATION_TYPES.orderPendingReview,
      recipient,
      status: NOTIFICATION_JOB_STATUSES.delivered,
      payload,
      idempotencyKey,
      providerMessageId,
      sentAt: new Date(),
    });
  } catch (error: unknown) {
    try {
      await upsertNotificationLog({
        sellerId,
        orderId,
        raffleId,
        channel: NOTIFICATION_CHANNELS.telegram,
        type: NOTIFICATION_TYPES.orderPendingReview,
        recipient,
        status: NOTIFICATION_JOB_STATUSES.failed,
        payload,
        idempotencyKey,
        errorMessage: toSafeErrorMessage(error),
      });
    } catch (logError: unknown) {
      console.error('Failed to persist Telegram notification failure log', logError);
    }
  }
};

const notifyBuyerOrderEmail = async (
  detail: NonNullable<Awaited<ReturnType<typeof getSellerOrderDetail>>>,
  type: typeof NOTIFICATION_TYPES.orderApproved | typeof NOTIFICATION_TYPES.orderRejected,
): Promise<void> => {
  const idempotencyKey = `email:${type}:${detail.order.id}`;
  const emailContent = buildBuyerOrderEmailContent(detail, type);
  const payload = {
    orderId: detail.order.id,
    raffleId: detail.order.raffleId,
    raffleTitle: detail.raffle.title,
    customerName: detail.customer.fullName,
    customerEmail: detail.customer.email,
    orderStatus: detail.order.status,
    rejectionReason: detail.order.rejectionReason,
    emailSubject: emailContent.subject,
  };

  try {
    const configurationError = getEmailConfigurationError();

    if (configurationError) {
      await upsertNotificationLog({
        sellerId: detail.order.sellerId,
        orderId: detail.order.id,
        raffleId: detail.order.raffleId,
        channel: NOTIFICATION_CHANNELS.email,
        type,
        recipient: detail.customer.email,
        status: NOTIFICATION_JOB_STATUSES.failed,
        payload,
        idempotencyKey,
        errorMessage: configurationError,
      });
      return;
    }

    await upsertNotificationLog({
      sellerId: detail.order.sellerId,
      orderId: detail.order.id,
      raffleId: detail.order.raffleId,
      channel: NOTIFICATION_CHANNELS.email,
      type,
      recipient: detail.customer.email,
      status: NOTIFICATION_JOB_STATUSES.processing,
      payload,
      idempotencyKey,
    });

    const providerMessageId = await sendBuyerOrderEmail({
      to: detail.customer.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await upsertNotificationLog({
      sellerId: detail.order.sellerId,
      orderId: detail.order.id,
      raffleId: detail.order.raffleId,
      channel: NOTIFICATION_CHANNELS.email,
      type,
      recipient: detail.customer.email,
      status: NOTIFICATION_JOB_STATUSES.delivered,
      payload,
      idempotencyKey,
      providerMessageId,
      sentAt: new Date(),
    });
  } catch (error: unknown) {
    try {
      await upsertNotificationLog({
        sellerId: detail.order.sellerId,
        orderId: detail.order.id,
        raffleId: detail.order.raffleId,
        channel: NOTIFICATION_CHANNELS.email,
        type,
        recipient: detail.customer.email,
        status: NOTIFICATION_JOB_STATUSES.failed,
        payload,
        idempotencyKey,
        errorMessage: toSafeErrorMessage(error),
      });
    } catch (logError: unknown) {
      console.error('Failed to persist buyer email notification failure log', logError);
    }
  }
};

const persistCompressedProof = async (
  orderId: string,
  compressedImage: Buffer,
): Promise<{ readonly storageKey: string; readonly proofUrl: string }> => {
  await mkdir(PROOF_STORAGE_DIR, { recursive: true });

  const storageKey = `${orderId}-${Date.now()}.webp`;
  const filePath = path.join(PROOF_STORAGE_DIR, storageKey);
  await writeFile(filePath, compressedImage);

  return {
    storageKey,
    proofUrl: `/local-proofs/${storageKey}`,
  };
};

const authorizeAdmin = (request: IncomingMessage): AdminContext | ErrorResponse => {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const payload = verifyAdminToken(bearerToken);

    if (!payload) {
      return {
        error: 'unauthorized',
        message: 'Invalid or expired admin token',
      };
    }

    return { sellerId: payload.sellerId };
  }

  const apiKey = getHeader(request, 'x-api-key');
  const sellerId = getHeader(request, 'x-seller-id');

  if (apiKey !== API_DEV_TOKEN) {
    return {
      error: 'unauthorized',
      message: 'Invalid or missing x-api-key header',
    };
  }

  if (!sellerId) {
    return {
      error: 'unauthorized',
      message: 'Missing x-seller-id header',
    };
  }

  return { sellerId };
};

interface AdminLoginBody {
  readonly username: string;
  readonly password: string;
}

const isAdminLoginBody = (value: unknown): value is AdminLoginBody =>
  typeof value === 'object' &&
  value !== null &&
  'username' in value &&
  typeof value.username === 'string' &&
  'password' in value &&
  typeof value.password === 'string';

const getQueryParam = (url: string, paramName: string): string | undefined => {
  const searchStart = url.indexOf('?');
  if (searchStart === -1) {
    return undefined;
  }
  const searchParams = new URLSearchParams(url.slice(searchStart));
  const value = searchParams.get(paramName);
  return value ?? undefined;
};

const handleAdminSse = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (pathname !== '/api/admin/events' || request.method !== 'GET') {
    return false;
  }

  const tokenFromQuery = request.url ? getQueryParam(request.url, 'token') : undefined;
  const bearerToken = getBearerToken(request);
  const effectiveToken = bearerToken ?? tokenFromQuery;

  if (!effectiveToken) {
    sendJson(response, 401, {
      error: 'unauthorized',
      message: 'Token is required for admin SSE.',
    });
    return true;
  }

  const payload = verifyAdminToken(effectiveToken);
  if (!payload) {
    sendJson(response, 401, {
      error: 'unauthorized',
      message: 'Invalid or expired admin token.',
    });
    return true;
  }

  const sellerId = payload.sellerId;

  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization',
    'x-accel-buffering': 'no',
  });

  response.write(`event: connected\ndata: ${JSON.stringify({ sellerId })}\n\n`);

  registerSseClient(sellerId, response);

  const keepAlive = setInterval(() => {
    try {
      response.write(':keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25_000);

  response.on('close', () => {
    clearInterval(keepAlive);
  });

  return true;
};

const handleAdminAuth = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (!pathname.startsWith('/api/admin/auth')) {
    return false;
  }

  if (pathname === '/api/admin/auth/login' && request.method === 'POST') {
    if (!ADMIN_PASSWORD || !JWT_SECRET) {
      sendJson(response, 503, {
        error: 'admin_auth_not_configured',
        message: 'Admin authentication is not configured.',
      });
      return true;
    }

    const body = await readJsonBody(request);

    if (!isAdminLoginBody(body)) {
      sendJson(response, 400, {
        error: 'invalid_login_request',
        message: 'Username and password are required.',
      });
      return true;
    }

    const username = body.username.trim();
    const password = body.password;

    if (!secureEquals(username, ADMIN_USERNAME) || !secureEquals(password, ADMIN_PASSWORD)) {
      sendJson(response, 401, {
        error: 'invalid_credentials',
        message: 'Usuario o contraseña inválidos.',
      });
      return true;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_JWT_TTL_SECONDS;
    const token = signAdminToken({
      sub: username,
      sellerId: ADMIN_SELLER_ID,
      role: ADMIN_ROLES.admin,
      exp: expiresAt,
    });

    sendJson(response, 200, {
      token,
      expiresAt,
      user: {
        username,
        sellerId: ADMIN_SELLER_ID,
      },
    });
    return true;
  }

  if (pathname === '/api/admin/auth/me' && request.method === 'GET') {
    const context = authorizeAdmin(request);

    if (isErrorResponse(context)) {
      sendJson(response, 401, context);
      return true;
    }

    sendJson(response, 200, {
      user: {
        username: ADMIN_USERNAME,
        sellerId: context.sellerId,
      },
    });
    return true;
  }

  sendJson(response, 404, { error: 'not_found', path: pathname });
  return true;
};

const handleAdminSettings = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (!pathname.startsWith('/api/admin/settings')) {
    return false;
  }

  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  if (pathname === '/api/admin/settings' && request.method === 'GET') {
    const data = await getSellerSettings({ sellerId: adminContext.sellerId });
    sendJson(response, 200, { data });
    return true;
  }

  if (pathname === '/api/admin/settings' && request.method === 'PATCH') {
    const parsed = sellerSettingsSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    const data = await updateSellerSettings({
      sellerId: adminContext.sellerId,
      settings: parsed.data,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (pathname === '/api/admin/settings/payment-qr' && request.method === 'POST') {
    const parsed = uploadCampaignImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const inputImage = decodeBase64Image(parsed.data.dataBase64);
      const compressed = await compressCampaignCover(inputImage, parsed.data.mimeType);
      const paymentQrImageUrl = await persistCampaignPaymentQrImage(
        adminContext.sellerId,
        compressed.buffer,
        compressed.mimeType,
      );
      const data = await updateSellerDefaultPaymentQrImage({
        sellerId: adminContext.sellerId,
        paymentQrImageUrl,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data: { paymentQrImageUrl, settings: data } });
    } catch (error: unknown) {
      sendJson(response, 400, {
        error: 'invalid_payment_qr_image',
        message: toSafeErrorMessage(error),
      });
    }

    return true;
  }

  // Uploads a QR for one of the seller's global payment methods. Returns the
  // stored URL only; the admin stores it inside the corresponding method and
  // saves the whole settings payload via PATCH /api/admin/settings.
  if (pathname === '/api/admin/settings/payment-method-qr' && request.method === 'POST') {
    const parsed = uploadCampaignImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const inputImage = decodeBase64Image(parsed.data.dataBase64);
      const compressed = await compressCampaignCover(inputImage, parsed.data.mimeType);
      const qrImageUrl = await persistCampaignPaymentQrImage(
        `method-${adminContext.sellerId}`,
        compressed.buffer,
        compressed.mimeType,
      );

      sendJson(response, 200, { data: { qrImageUrl } });
    } catch (error: unknown) {
      sendJson(response, 400, {
        error: 'invalid_payment_qr_image',
        message: toSafeErrorMessage(error),
      });
    }

    return true;
  }

  sendJson(response, 404, { error: 'not_found', path: pathname });
  return true;
};

const isErrorResponse = (value: AdminContext | ErrorResponse): value is ErrorResponse =>
  'error' in value;

interface FlattenableValidationError {
  flatten: () => unknown;
}

const toValidationErrorResponse = (error: FlattenableValidationError): ErrorResponse => ({
  error: 'validation_error',
  details: error.flatten(),
});

const sendPublicOrderError = (response: ServerResponse, error: unknown, pathname: string): void => {
  const message = toSafeErrorMessage(error);

  if (message.includes('no longer available') || message.includes('Not enough available')) {
    sendJson(response, 409, {
      error: 'number_conflict',
      message: 'No hay suficientes números disponibles. Intenta con una cantidad menor.',
    });
    return;
  }

  if (
    message.includes('required') ||
    message.includes('not allowed') ||
    message.includes('out of range')
  ) {
    sendJson(response, 400, {
      error: 'invalid_order_request',
      message,
    });
    return;
  }

  sendJson(response, 500, {
    error: 'order_creation_failed',
    message: 'Could not create public order',
    details: { path: pathname },
  });
};

const sendAdminReviewError = (response: ServerResponse, error: unknown): void => {
  const message = toSafeErrorMessage(error);

  if (message.includes('not pending review') || message.includes('Not enough available numbers')) {
    sendJson(response, 409, {
      error: 'order_review_conflict',
      message,
    });
    return;
  }

  if (message.includes('without payment proof') || message.includes('does not match')) {
    sendJson(response, 400, {
      error: 'invalid_order_review',
      message,
    });
    return;
  }

  sendJson(response, 500, {
    error: 'order_review_failed',
    message: 'Could not review order',
  });
};

const getHealth = (): ApiHealthResponse => ({
  service: 'rifa-api',
  status: 'ok',
  timestamp: new Date().toISOString(),
});

const getDatabaseHealth = async (): Promise<
  DatabaseHealthSuccessResponse | DatabaseHealthFailureResponse
> => {
  try {
    const result = await getLocalDatabaseHealth();

    return {
      ok: true,
      driver: result.driver,
      sellersCount: result.sellersCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      driver: 'unknown',
      error: toSafeErrorMessage(error),
      timestamp: new Date().toISOString(),
    };
  }
};

const getPathname = (request: IncomingMessage): string => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  return url.pathname;
};

const getSegments = (pathname: string): readonly string[] => pathname.split('/').filter(Boolean);

const handleCampaignAssets = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'local-campaign-assets' || request.method !== 'GET') {
    return false;
  }

  const fileName = segments[1];

  if (!fileName) {
    sendJson(response, 404, { error: 'not_found', path: pathname });
    return true;
  }

  const safeName = path.basename(fileName);
  const filePath = path.join(CAMPAIGN_ASSETS_DIR, safeName);

  try {
    const file = await readFile(filePath);
    const mimeType = safeName.endsWith('.png')
      ? 'image/png'
      : safeName.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    sendBinary(response, 200, mimeType, file);
    return true;
  } catch {
    sendJson(response, 404, { error: 'not_found', path: pathname });
    return true;
  }
};

const handleAdminRaffles = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin' || segments[2] !== 'raffles') {
    return false;
  }

  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  const raffleId = segments[3];

  if (request.method === 'GET' && raffleId === 'active' && segments.length === 4) {
    const data = await getSellerActiveRaffle({ sellerId: adminContext.sellerId });
    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'POST' && raffleId && segments[4] === 'activate') {
    const data = await activateSellerRaffle({
      sellerId: adminContext.sellerId,
      raffleId,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'POST' && raffleId && segments[4] === 'cover') {
    const parsed = uploadCampaignImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const inputImage = decodeBase64Image(parsed.data.dataBase64);
      const coverImage = await removeLightBackgroundFromCampaignCover(inputImage);
      const coverImageUrl = await persistCampaignCoverImage(
        raffleId,
        coverImage,
        'image/png',
      );
      const updated = await updateSellerRaffleCoverImage({
        sellerId: adminContext.sellerId,
        raffleId,
        coverImageUrl,
      });

      if (!updated) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data: { coverImageUrl } });
    } catch (error: unknown) {
      sendJson(response, 400, {
        error: 'invalid_cover_image',
        message: toSafeErrorMessage(error),
      });
    }

    return true;
  }

  if (request.method === 'POST' && raffleId && segments[4] === 'payment-qr') {
    const parsed = uploadCampaignImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const inputImage = decodeBase64Image(parsed.data.dataBase64);
      const compressed = await compressCampaignCover(inputImage, parsed.data.mimeType);
      const paymentQrImageUrl = await persistCampaignPaymentQrImage(
        raffleId,
        compressed.buffer,
        compressed.mimeType,
      );
      const updated = await updateSellerRafflePaymentQrImage({
        sellerId: adminContext.sellerId,
        raffleId,
        paymentQrImageUrl,
      });

      if (!updated) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data: { paymentQrImageUrl } });
    } catch (error: unknown) {
      sendJson(response, 400, {
        error: 'invalid_payment_qr_image',
        message: toSafeErrorMessage(error),
      });
    }

    return true;
  }

  if (request.method === 'GET' && !raffleId) {
    const data = await listSellerRaffles({ sellerId: adminContext.sellerId });
    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'GET' && raffleId && segments[4] === 'numbers') {
    const data = await listSellerRaffleNumbers({
      sellerId: adminContext.sellerId,
      raffleId,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'GET' && raffleId && segments[4] === 'export') {
    const rows = await listSellerRaffleOrdersForExport({
      sellerId: adminContext.sellerId,
      raffleId,
    });

    if (!rows) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    const header =
      'order_id,status,amount,currency,numbers_requested,created_at,customer_name,customer_email,customer_phone,customer_document';
    const lines = rows.map((row) =>
      [
        row.orderId,
        row.status,
        row.amount,
        row.currency,
        row.numbersRequested,
        row.createdAt.toISOString(),
        `"${row.customerName.replaceAll('"', '""')}"`,
        row.customerEmail,
        row.customerPhone,
        row.customerDocument,
      ].join(','),
    );

    sendText(response, 200, 'text/csv; charset=utf-8', [header, ...lines].join('\n'));
    return true;
  }

  if (raffleId && segments[4] === 'draw-result') {
    if (request.method === 'GET') {
      const data = await getSellerDrawResult({
        sellerId: adminContext.sellerId,
        raffleId,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data });
      return true;
    }

    if (request.method === 'POST') {
      const parsed = registerDrawResultSchema.safeParse(await readJsonBody(request));

      if (!parsed.success) {
        sendJson(response, 400, toValidationErrorResponse(parsed.error));
        return true;
      }

      try {
        const data = await registerSellerDrawResult({
          sellerId: adminContext.sellerId,
          raffleId,
          ...parsed.data,
        });
        sendJson(response, 201, { data });
      } catch (error: unknown) {
        sendJson(response, 409, {
          error: 'draw_result_conflict',
          message: toSafeErrorMessage(error),
        });
      }

      return true;
    }
  }

  if (raffleId && segments[4] === 'prizes') {
    if (request.method === 'GET') {
      const data = await listSellerRafflePrizes({
        sellerId: adminContext.sellerId,
        raffleId,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data });
      return true;
    }

    if (request.method === 'POST') {
      const parsed = createPrizeSchema.safeParse(await readJsonBody(request));

      if (!parsed.success) {
        sendJson(response, 400, toValidationErrorResponse(parsed.error));
        return true;
      }

      const data = await createSellerRafflePrize({
        sellerId: adminContext.sellerId,
        raffleId,
        ...parsed.data,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 201, { data });
      return true;
    }
  }

  if (request.method === 'GET' && raffleId && segments.length === 4) {
    const data = await getSellerRaffleById({ sellerId: adminContext.sellerId, raffleId });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'POST' && !raffleId) {
    const parsed = createAdminRaffleSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    const data = await createSellerRaffle({
      sellerId: adminContext.sellerId,
      payload: parsed.data,
    });
    sendJson(response, 201, { data });
    return true;
  }

  if (request.method === 'PATCH' && raffleId) {
    const parsed = updateAdminRaffleSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    const data = await updateSellerRaffle({
      sellerId: adminContext.sellerId,
      raffleId,
      payload: parsed.data,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  sendJson(response, 405, {
    error: 'method_not_allowed',
    path: pathname,
  });
  return true;
};

const handleAdminWinners = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin') {
    return false;
  }

  const isWinnersRoute = segments[2] === 'winners';
  const isGalleryRoute = segments[2] === 'delivery-gallery';

  if (!isWinnersRoute && !isGalleryRoute) {
    return false;
  }

  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  if (isWinnersRoute) {
    const winnerId = segments[3];

    if (request.method === 'GET' && !winnerId) {
      const data = await listSellerWinners(adminContext.sellerId);
      sendJson(response, 200, { data });
      return true;
    }

    if (request.method === 'PATCH' && winnerId) {
      const parsed = updateWinnerSchema.safeParse(await readJsonBody(request));

      if (!parsed.success) {
        sendJson(response, 400, toValidationErrorResponse(parsed.error));
        return true;
      }

      const data = await updateSellerWinner({
        sellerId: adminContext.sellerId,
        winnerId,
        ...parsed.data,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data });
      return true;
    }

    if (request.method === 'POST' && winnerId && segments[4] === 'photo') {
      const parsed = uploadCampaignImageSchema.safeParse(await readJsonBody(request));

      if (!parsed.success) {
        sendJson(response, 400, toValidationErrorResponse(parsed.error));
        return true;
      }

      try {
        const inputImage = decodeBase64Image(parsed.data.dataBase64);
        const compressed = await compressCampaignCover(inputImage, parsed.data.mimeType);
        const winnerPhotoUrl = await persistCampaignAssetImage(
          winnerId,
          compressed.buffer,
          compressed.mimeType,
          'winner',
        );
        const data = await updateSellerWinner({
          sellerId: adminContext.sellerId,
          winnerId,
          winnerPhotoUrl,
        });

        if (!data) {
          sendJson(response, 404, { error: 'not_found', path: pathname });
          return true;
        }

        sendJson(response, 200, { data });
      } catch (error: unknown) {
        sendJson(response, 400, {
          error: 'invalid_winner_photo',
          message: toSafeErrorMessage(error),
        });
      }

      return true;
    }

    sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
    return true;
  }

  const imageId = segments[3];

  if (request.method === 'GET' && !imageId) {
    const data = await listSellerDeliveryGallery(adminContext.sellerId);
    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'POST' && !imageId) {
    const parsed = createGalleryImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const inputImage = decodeBase64Image(parsed.data.image.dataBase64);
      const compressed = await compressCampaignCover(inputImage, parsed.data.image.mimeType);
      const imageUrl = await persistCampaignAssetImage(
        adminContext.sellerId,
        compressed.buffer,
        compressed.mimeType,
        'gallery',
      );
      const data = await createSellerDeliveryGalleryImage({
        sellerId: adminContext.sellerId,
        imageUrl,
        title: parsed.data.title,
        caption: parsed.data.caption,
        isPublic: parsed.data.isPublic,
        displayOrder: parsed.data.displayOrder,
      });

      sendJson(response, 201, { data });
    } catch (error: unknown) {
      sendJson(response, 400, {
        error: 'invalid_gallery_image',
        message: toSafeErrorMessage(error),
      });
    }

    return true;
  }

  if (request.method === 'PATCH' && imageId) {
    const parsed = updateGalleryImageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    const data = await updateSellerDeliveryGalleryImage({
      sellerId: adminContext.sellerId,
      imageId,
      ...parsed.data,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'DELETE' && imageId) {
    const ok = await deleteSellerDeliveryGalleryImage({
      sellerId: adminContext.sellerId,
      imageId,
    });

    if (!ok) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data: { ok: true } });
    return true;
  }

  sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
  return true;
};

const handleAdminOrders = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin' || segments[2] !== 'orders') {
    return false;
  }

  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  const orderId = segments[3];

  if (request.method === 'POST' && orderId && segments[4] === 'approve') {
    try {
      const data = await approveSellerOrder({ sellerId: adminContext.sellerId, orderId });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data });
      void notifyBuyerOrderEmail(data, NOTIFICATION_TYPES.orderApproved);
      broadcastToSeller(adminContext.sellerId, {
        type: 'order_reviewed',
        data: { orderId, status: data.order.status },
      });
      return true;
    } catch (error: unknown) {
      sendAdminReviewError(response, error);
      return true;
    }
  }

  if (request.method === 'POST' && orderId && segments[4] === 'reject') {
    const parsed = rejectAdminOrderSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    try {
      const data = await rejectSellerOrder({
        sellerId: adminContext.sellerId,
        orderId,
        reason: parsed.data.reason,
      });

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      sendJson(response, 200, { data });
      void notifyBuyerOrderEmail(data, NOTIFICATION_TYPES.orderRejected);
      broadcastToSeller(adminContext.sellerId, {
        type: 'order_reviewed',
        data: { orderId, status: data.order.status },
      });
      return true;
    } catch (error: unknown) {
      sendAdminReviewError(response, error);
      return true;
    }
  }

  if (request.method === 'POST' && orderId === 'manual' && segments.length === 4) {
    const parsed = createManualOrderSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    let proof: ManualOrderProof | undefined;

    if (parsed.data.proof) {
      try {
        const inputImage = decodeBase64Image(parsed.data.proof.dataBase64);
        const compressedImage = await compressPaymentProof(inputImage);
        const persisted = await persistCompressedProof(`manual-${Date.now()}`, compressedImage);
        proof = {
          proofUrl: persisted.proofUrl,
          storageKey: persisted.storageKey,
          mimeType: COMPRESSED_PROOF_MIME_TYPE,
          sizeBytes: compressedImage.byteLength,
        };
      } catch (error: unknown) {
        sendJson(response, 400, {
          error: 'invalid_proof_image',
          message: toSafeErrorMessage(error),
        });
        return true;
      }
    }

    try {
      const { proof: _ignoredProof, ...orderFields } = parsed.data;
      void _ignoredProof;
      const data = await createManualSellerOrder({
        sellerId: adminContext.sellerId,
        ...orderFields,
        ...(proof ? { proof } : {}),
      });

      if (!data) {
        sendJson(response, 404, {
          error: 'not_found',
          message: 'No hay una campaña activa para registrar la compra.',
          path: pathname,
        });
        return true;
      }

      sendJson(response, 201, { data });
      void notifyBuyerOrderEmail(data, NOTIFICATION_TYPES.orderApproved);
      broadcastToSeller(adminContext.sellerId, {
        type: 'new_order',
        data: {
          orderId: data.order.id,
          numbersRequested: data.order.numbersRequested,
          amount: data.order.amount,
          currency: data.order.currency,
        },
      });
      return true;
    } catch (error: unknown) {
      const message = toSafeErrorMessage(error);

      if (message.includes('no longer available') || message.includes('Not enough available')) {
        sendJson(response, 409, { error: 'number_conflict', message });
        return true;
      }

      sendJson(response, 400, { error: 'manual_order_failed', message });
      return true;
    }
  }

  if (request.method === 'GET' && !orderId) {
    const data = await listSellerOrders(adminContext.sellerId);
    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'GET' && orderId && segments[4] === 'proof') {
    const detail = await getSellerOrderDetail({ sellerId: adminContext.sellerId, orderId });

    if (!detail?.order.paymentProofStorageKey) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    const filePath = path.join(PROOF_STORAGE_DIR, detail.order.paymentProofStorageKey);
    const proof = await readFile(filePath);
    sendBinary(response, 200, detail.order.paymentProofMimeType ?? 'image/webp', proof);
    return true;
  }

  if (request.method === 'GET' && orderId) {
    const data = await getSellerOrderDetail({ sellerId: adminContext.sellerId, orderId });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  sendJson(response, 405, {
    error: 'method_not_allowed',
    path: pathname,
  });
  return true;
};

const handleAdminPrizes = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin' || segments[2] !== 'prizes') {
    return false;
  }

  const prizeId = segments[3];
  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  if (!prizeId) {
    sendJson(response, 404, { error: 'not_found', path: pathname });
    return true;
  }

  if (request.method === 'PATCH') {
    const parsed = updatePrizeSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      sendJson(response, 400, toValidationErrorResponse(parsed.error));
      return true;
    }

    const data = await updateSellerRafflePrize({
      sellerId: adminContext.sellerId,
      prizeId,
      ...parsed.data,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method === 'DELETE') {
    const deleted = await deleteSellerRafflePrize({
      sellerId: adminContext.sellerId,
      prizeId,
    });

    if (!deleted) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data: { deleted: true } });
    return true;
  }

  sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
  return true;
};

const handleAdminNumbers = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin' || segments[2] !== 'numbers') {
    return false;
  }

  const raffleNumberId = segments[3];
  const action = segments[4];
  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
    return true;
  }

  // Block a number by value (lazy model: blocking creates a row).
  // POST /api/admin/numbers/block  body: { raffleId, number }
  if (raffleNumberId === 'block' && !action) {
    const body = (await readJsonBody(request)) as {
      readonly raffleId?: unknown;
      readonly number?: unknown;
    };
    const raffleId = typeof body.raffleId === 'string' ? body.raffleId : '';
    const numberValue = Number(body.number);

    if (!raffleId || !Number.isInteger(numberValue)) {
      sendJson(response, 400, {
        error: 'invalid_block_request',
        message: 'raffleId y number son requeridos.',
      });
      return true;
    }

    const ok = await blockSellerRaffleNumberByValue({
      sellerId: adminContext.sellerId,
      raffleId,
      number: numberValue,
    });
    sendJson(response, ok ? 200 : 409, { data: { ok } });
    return true;
  }

  if (raffleNumberId && action === 'release') {
    const ok = await releaseSellerRaffleNumber({
      sellerId: adminContext.sellerId,
      raffleNumberId,
    });
    sendJson(response, ok ? 200 : 409, { data: { ok } });
    return true;
  }

  sendJson(response, 404, { error: 'not_found', path: pathname });
  return true;
};

const handleAdminInsights = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'admin') {
    return false;
  }

  const resource = segments[2];
  const resourceId = segments[3];
  const resourceAction = segments[4];
  const allowedResources = new Set(['customers', 'audit-logs', 'notifications']);

  if (!resource || !allowedResources.has(resource)) {
    return false;
  }

  const adminContext = authorizeAdmin(request);

  if (isErrorResponse(adminContext)) {
    sendJson(response, 401, adminContext);
    return true;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
    return true;
  }

  if (resource === 'customers' && resourceId && resourceAction === 'detail') {
    const data = await getCustomerDetail({
      sellerId: adminContext.sellerId,
      customerId: resourceId,
    });

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (resource === 'customers') {
    const data = await listSellerCustomers({ sellerId: adminContext.sellerId });
    sendJson(response, 200, { data });
    return true;
  }

  if (resource === 'audit-logs') {
    const data = await listSellerAuditLogs({ sellerId: adminContext.sellerId });
    sendJson(response, 200, { data });
    return true;
  }

  const data = await listSellerNotificationLogs({ sellerId: adminContext.sellerId });
  sendJson(response, 200, { data });
  return true;
};

const handlePublicSellerSettings = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (pathname !== '/api/public/seller-settings' || request.method !== 'GET') {
    return false;
  }

  const data = await getSellerSettings({ sellerId: ADMIN_SELLER_ID });
  sendJson(response, 200, { data });
  return true;
};

const handlePublicRaffles = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'public' || segments[2] !== 'raffles') {
    return false;
  }

  const slug = segments[3];

  if (request.method === 'GET' && slug === 'current' && segments.length === 4) {
    const data = await getPublicCurrentActiveRaffle();

    if (!data) {
      sendJson(response, 404, {
        error: 'no_active_event',
        message: 'Por ahora no hay eventos activos.',
        path: pathname,
      });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (request.method !== 'GET' || !slug) {
    if (request.method === 'POST' && slug && segments.length === 5 && segments[4] === 'orders') {
      const parsed = createPublicOrderSchema.safeParse(await readJsonBody(request));

      if (!parsed.success) {
        sendJson(response, 400, toValidationErrorResponse(parsed.error));
        return true;
      }

      let data: Awaited<ReturnType<typeof createPublicOrderForRaffle>>;

      try {
        data = await createPublicOrderForRaffle({ slug, payload: parsed.data });
      } catch (error: unknown) {
        sendPublicOrderError(response, error, pathname);
        return true;
      }

      if (!data) {
        sendJson(response, 404, { error: 'not_found', path: pathname });
        return true;
      }

      void broadcastToSeller(data.order.sellerId, {
        type: 'new_order',
        data: {
          orderId: data.order.id,
          numbersRequested: data.order.numbersRequested,
          amount: data.order.amount,
          currency: data.order.currency,
        },
      });

      sendJson(response, 201, { data });
      return true;
    }

    sendJson(response, 405, {
      error: 'method_not_allowed',
      path: pathname,
    });
    return true;
  }

  if (segments[4] === 'numbers') {
    const data = await listPublicRaffleNumbersBySlug(slug);

    if (!data) {
      sendJson(response, 404, {
        error: 'not_found',
        message: 'Esta campaña no está disponible.',
        path: pathname,
      });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (segments[4] === 'stats') {
    const data = await getPublicRaffleStatsBySlug(slug);

    if (!data) {
      sendJson(response, 404, {
        error: 'not_found',
        message: 'Esta campaña no está disponible.',
        path: pathname,
      });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (segments[4] === 'result') {
    const data = await getPublicDrawResultBySlug(slug);

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (segments[4] === 'winners-content') {
    const data = await getPublicWinnersContentBySlug(slug);

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (segments.length === 4) {
    const data = await getPublicActiveRaffleBySlug(slug);

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  sendJson(response, 404, { error: 'not_found', path: pathname });
  return true;
};

const handlePublicOrders = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  const segments = getSegments(pathname);

  if (segments[0] !== 'api' || segments[1] !== 'public' || segments[2] !== 'orders') {
    return false;
  }

  const orderId = segments[3];
  const action = segments[4];

  if (!orderId) {
    return false;
  }

  if (action === 'status' && request.method === 'GET') {
    const data = await getPublicOrderStatus(orderId);

    if (!data) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, { data });
    return true;
  }

  if (action !== 'proof') {
    return false;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method_not_allowed', path: pathname });
    return true;
  }

  const parsed = uploadPaymentProofSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    sendJson(response, 400, toValidationErrorResponse(parsed.error));
    return true;
  }

  try {
    const inputImage = decodeBase64Image(parsed.data.dataBase64);
    const compressedImage = await compressPaymentProof(inputImage);
    const proof = await persistCompressedProof(orderId, compressedImage);
    const order = await attachPaymentProofToOrder({
      orderId,
      proofUrl: proof.proofUrl,
      storageKey: proof.storageKey,
      mimeType: COMPRESSED_PROOF_MIME_TYPE,
      sizeBytes: compressedImage.byteLength,
    });

    if (!order) {
      sendJson(response, 404, { error: 'not_found', path: pathname });
      return true;
    }

    sendJson(response, 200, {
      data: {
        orderId: order.id,
        mimeType: order.paymentProofMimeType,
        sizeBytes: order.paymentProofSizeBytes,
        proofUrl: order.paymentProofUrl,
        storageKey: order.paymentProofStorageKey,
      },
    });
    void notifySellerPaymentProofUploaded({
      sellerId: order.sellerId,
      orderId: order.id,
      raffleId: order.raffleId,
    });
    broadcastToSeller(order.sellerId, {
      type: 'order_proof',
      data: { orderId: order.id },
    });
    return true;
  } catch (error: unknown) {
    sendJson(response, 400, {
      error: 'invalid_proof_image',
      message: toSafeErrorMessage(error),
    });
    return true;
  }
};

export const createRifaApiServer = () =>
  createServer((request, response) => {
    void (async () => {
      const pathname = getPathname(request);

      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type, x-api-key, x-seller-id',
          'access-control-max-age': '86400',
        });
        response.end();
        return;
      }

      if (request.method === 'GET' && pathname === '/api/health') {
        sendJson(response, 200, getHealth());
        return;
      }

      if (request.method === 'GET' && pathname === '/api/health/db') {
        const dbHealth = await getDatabaseHealth();
        sendJson(response, dbHealth.ok ? 200 : 503, dbHealth);
        return;
      }

      if (await handleAdminAuth(request, response, pathname)) {
        return;
      }

      if (await handleCampaignAssets(request, response, pathname)) {
        return;
      }

      if (await handleAdminSettings(request, response, pathname)) {
        return;
      }

      if (await handleAdminRaffles(request, response, pathname)) {
        return;
      }

      if (await handleAdminWinners(request, response, pathname)) {
        return;
      }

      if (await handleAdminOrders(request, response, pathname)) {
        return;
      }

      if (await handleAdminInsights(request, response, pathname)) {
        return;
      }

      if (await handleAdminPrizes(request, response, pathname)) {
        return;
      }

      if (await handleAdminNumbers(request, response, pathname)) {
        return;
      }

      if (await handleAdminSse(request, response, pathname)) {
        return;
      }

      if (await handlePublicSellerSettings(request, response, pathname)) {
        return;
      }

      if (await handlePublicRaffles(request, response, pathname)) {
        return;
      }

      if (await handlePublicOrders(request, response, pathname)) {
        return;
      }

      sendJson(response, 404, {
        error: 'not_found',
        path: pathname,
      });
    })().catch((error: unknown) => {
      sendJson(response, 500, {
        ok: false,
        driver: 'unknown',
        error: toSafeErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    });
  });

const port = Number(process.env.PORT ?? 3000);
const server = createRifaApiServer();

void (async () => {
  const { client } = createRifaDatabase();

  try {
    await ensureLocalSchema(client);
  } finally {
    await client.close();
  }

  server.listen(port, () => {
    console.log(`Rifa API listening on http://localhost:${port}/api`);
  });
})().catch((error: unknown) => {
  console.error('Failed to start Rifa API.', error);
  process.exitCode = 1;
});
