import { PrismaClient, TransactionType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { analyseBehaviour, type LedgerObservation } from '@ledgerpulse/domain';

const prisma = new PrismaClient();
const userId = process.env.DEMO_USER_ID ?? '00000000-0000-4000-8000-000000000001';

const categories = [
  ['10000000-0000-4000-8000-000000000001', 'Salary', 'salary', TransactionType.INCOME, '#2F6B57'],
  ['10000000-0000-4000-8000-000000000002', 'Freelance', 'freelance', TransactionType.INCOME, '#3E7B6C'],
  ['10000000-0000-4000-8000-000000000003', 'Food', 'food', TransactionType.EXPENSE, '#D97757'],
  ['10000000-0000-4000-8000-000000000004', 'Transport', 'transport', TransactionType.EXPENSE, '#5274A5'],
  ['10000000-0000-4000-8000-000000000005', 'Housing', 'housing', TransactionType.EXPENSE, '#8A6FA8'],
  ['10000000-0000-4000-8000-000000000006', 'Entertainment', 'entertainment', TransactionType.EXPENSE, '#C25368'],
  ['10000000-0000-4000-8000-000000000007', 'Utilities', 'utilities', TransactionType.EXPENSE, '#B4873D'],
  ['10000000-0000-4000-8000-000000000008', 'Health', 'health', TransactionType.EXPENSE, '#3E8B8B'],
  ['10000000-0000-4000-8000-000000000009', 'Shopping', 'shopping', TransactionType.EXPENSE, '#9A6653'],
] as const;

interface DemoTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  categoryId: string;
  categoryName: string;
  description: string;
  daysAgo: number;
  utcHour: number;
}

function demoTransactions(): DemoTransaction[] {
  const salaryId = categories[0][0];
  const foodId = categories[2][0];
  const entertainmentId = categories[5][0];
  const items: DemoTransaction[] = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      type: TransactionType.INCOME,
      amount: '50000.00',
      categoryId: salaryId,
      categoryName: 'Salary',
      description: 'Demo · Previous salary',
      daysAgo: 40,
      utcHour: 4,
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      type: TransactionType.INCOME,
      amount: '52000.00',
      categoryId: salaryId,
      categoryName: 'Salary',
      description: 'Demo · Current salary',
      daysAgo: 3,
      utcHour: 4,
    },
  ];
  const foodAmounts = ['480.00', '525.00', '610.00', '455.00', '570.00'];
  for (let index = 0; index < 20; index += 1) {
    items.push({
      id: `41000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: TransactionType.EXPENSE,
      amount: foodAmounts[index % foodAmounts.length]!,
      categoryId: foodId,
      categoryName: 'Food',
      description: 'Demo · Everyday meal',
      daysAgo: 48 - index * 2,
      utcHour: 7 + (index % 3),
    });
  }
  const entertainmentAmounts = ['550.00', '620.00', '700.00', '580.00', '650.00'];
  for (let index = 0; index < 14; index += 1) {
    items.push({
      id: `42000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: TransactionType.EXPENSE,
      amount: entertainmentAmounts[index % entertainmentAmounts.length]!,
      categoryId: entertainmentId,
      categoryName: 'Entertainment',
      description: 'Demo · Regular entertainment',
      daysAgo: 57 - index * 4,
      utcHour: 13,
    });
  }
  items.push({
    id: '43000000-0000-4000-8000-000000000001',
    type: TransactionType.EXPENSE,
    amount: '12000.00',
    categoryId: entertainmentId,
    categoryName: 'Entertainment',
    description: 'Demo · Festival tickets',
    daysAgo: 1,
    utcHour: 1,
  });
  return items;
}

function transactionDate(daysAgo: number, utcHour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(utcHour, 0, 0, 0);
  return date;
}

async function seedDemoTransactions(): Promise<void> {
  const ordered = demoTransactions().sort((left, right) => right.daysAgo - left.daysAgo);
  for (const item of ordered) {
    const existing = await prisma.transaction.findUnique({ where: { id: item.id }, select: { id: true } });
    if (existing) continue;
    const date = transactionDate(item.daysAgo, item.utcHour);
    const historyRows = await prisma.transaction.findMany({
      where: { userId, type: TransactionType.EXPENSE, transactionDate: { lt: date } },
      include: { category: { select: { name: true } } },
      orderBy: { transactionDate: 'asc' },
    });
    const history: LedgerObservation[] = historyRows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount.toFixed(2),
      currency: 'INR',
      categoryId: row.categoryId,
      categoryName: row.category.name,
      transactionDate: row.transactionDate.toISOString(),
      ...(row.anomalyScore !== null ? { anomalyScore: row.anomalyScore } : {}),
      ...(row.anomalyConfidence !== null ? { anomalyConfidence: row.anomalyConfidence } : {}),
    }));
    const candidate: LedgerObservation = {
      type: item.type,
      amount: item.amount,
      currency: 'INR',
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      transactionDate: date.toISOString(),
    };
    const analysis = analyseBehaviour({ candidate, history, timezone: 'Asia/Kolkata' });
    await prisma.transaction.create({
      data: {
        id: item.id,
        userId,
        categoryId: item.categoryId,
        type: item.type,
        amount: item.amount,
        currency: 'INR',
        description: item.description,
        transactionDate: date,
        anomalyScore: analysis.score,
        anomalyConfidence: analysis.confidence,
        anomalyVersion: analysis.engineVersion,
        anomalyAnalysis: analysis as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: userId },
    update: { timezone: 'Asia/Kolkata' },
    create: { id: userId, email: 'demo@ledgerpulse.local', displayName: 'Demo Ledger', timezone: 'Asia/Kolkata' },
  });
  for (const [id, name, slug, type, color] of categories) {
    await prisma.category.upsert({
      where: { userId_slug: { userId, slug } },
      update: { name, type, color, isActive: true },
      create: { id, userId, name, slug, type, color },
    });
  }
  if (process.env.SEED_DEMO_DATA !== 'false') await seedDemoTransactions();
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
