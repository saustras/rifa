import {
  ASSIGNMENT_MODES,
  DEFAULT_LANDING_CONFIG,
  RAFFLE_STATUSES,
  ROLES,
} from '@rifa/shared';

import { createLocalPgliteDatabase, ensureLocalSchema } from './client';
import { rafflePrizes, raffles, sellers, users } from './schema';

const seed = async () => {
  const { client, db } = createLocalPgliteDatabase();

  await ensureLocalSchema(client);

  await db
    .insert(sellers)
    .values({
      id: 'seller_demo',
      name: 'Demo Rifa Seller',
      email: 'seller@example.com',
      phone: '+570000000000',
      status: 'active',
      telegramChatId: 'change-me',
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      id: 'user_demo_admin',
      sellerId: 'seller_demo',
      name: 'Admin Demo',
      email: 'admin@example.com',
      passwordHash: 'replace-with-real-hash-before-auth',
      role: ROLES.seller,
      status: 'active',
    })
    .onConflictDoNothing();

  await db
    .insert(raffles)
    .values({
      id: 'raffle_demo_moto',
      sellerId: 'seller_demo',
      title: 'Rifa Demo Moto Eléctrica',
      slug: 'rifa-demo-moto-electrica',
      description: 'Rifa demo para validar la fundación local de base de datos.',
      status: RAFFLE_STATUSES.active,
      landingConfig: {
        ...DEFAULT_LANDING_CONFIG,
        heroTitle: 'Gana esta increíble',
        heroAccent: 'moto eléctrica',
        heroSubtitle:
          'Participa con números verificados, pagos revisados y sorteo externo transparente.',
        prizeLabel: 'Moto eléctrica — premio principal',
      },
      pricePerNumber: '10000.00',
      currency: 'COP',
      numberMin: 0,
      numberMax: 99,
      numberPadding: 2,
      assignmentMode: ASSIGNMENT_MODES.customerChoice,
      reservationTtlMinutes: 30,
      drawSourceName: 'Lotería demo',
      drawRule: 'Últimas 2 cifras del premio mayor',
      paymentMethodLabel: 'Nequi / Transferencia',
      paymentAccountHolder: 'ORYUM S.A.S.',
      paymentAccountType: 'Nequi',
      paymentAccountNumber: '300 123 4567',
      paymentDocumentNumber: '901.234.567-8',
      paymentInstructions:
        'Transfiere el monto exacto e incluye tu número de documento en la referencia.',
    })
    .onConflictDoUpdate({
      target: raffles.id,
      set: {
        status: RAFFLE_STATUSES.active,
        landingConfig: {
          ...DEFAULT_LANDING_CONFIG,
          heroTitle: 'Gana esta increíble',
          heroAccent: 'moto eléctrica',
          heroSubtitle:
            'Participa con números verificados, pagos revisados y sorteo externo transparente.',
          prizeLabel: 'Moto eléctrica — premio principal',
        },
        paymentMethodLabel: 'Nequi / Transferencia',
        paymentAccountHolder: 'ORYUM S.A.S.',
        paymentAccountType: 'Nequi',
        paymentAccountNumber: '300 123 4567',
        paymentDocumentNumber: '901.234.567-8',
        paymentInstructions:
          'Transfiere el monto exacto e incluye tu número de documento en la referencia.',
        updatedAt: new Date(),
      },
    });

  await db
    .insert(rafflePrizes)
    .values({
      id: 'prize_demo_moto_main',
      raffleId: 'raffle_demo_moto',
      title: 'Premio demo',
      description: 'Premio principal de demostración.',
      commercialValue: '1000000.00',
      position: 1,
    })
    .onConflictDoNothing();

  // Lazy allocation: do NOT pre-create number rows. Numbers become rows only
  // when they are reserved/assigned/blocked, so the demo raffle starts fully
  // available without any raffle_numbers rows.

  await client.close();
};

seed()
  .then(() => {
    console.log('Database seed completed.');
  })
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  });
