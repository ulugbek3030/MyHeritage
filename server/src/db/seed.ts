import { pool, query, getClient } from './pool.js';
import bcrypt from 'bcrypt';
import { authConfig } from '../config/auth.js';

async function seed() {
  console.log('🌱 Seeding database...\n');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Create test user (phone-based auth)
    const passwordHash = await bcrypt.hash('test123', authConfig.bcryptRounds);
    const userRes = await client.query(
      `INSERT INTO users (id, phone, password_hash)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (phone) DO UPDATE SET password_hash = $2
       RETURNING id`,
      ['+9980000001', passwordHash]
    );
    const userId = userRes.rows[0].id;
    console.log('  👤 User created:', userId);

    // 2. Create tree
    const treeRes = await client.query(
      `INSERT INTO trees (id, user_id, name, description)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id`,
      [userId, 'Семейное Древо Рустамовых', 'Семья Рустамовых-Усмановых, 3 поколения']
    );
    const treeId = treeRes.rows[0].id;
    console.log('  🌳 Tree created:', treeId);

    // 3. Create persons
    const persons: Record<string, string> = {};

    async function addPerson(
      key: string, firstName: string, lastName: string | null, middleName: string | null,
      maidenName: string | null, gender: string, birthYear: number | null,
      isAlive: boolean, deathYear: number | null, photoUrl: string | null, note: string | null
    ) {
      const res = await client.query(
        `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender, birth_year, is_alive, death_year, photo_url, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [treeId, firstName, lastName, middleName, maidenName, gender, birthYear, isAlive, deathYear, photoUrl, note]
      );
      persons[key] = res.rows[0].id;
    }

    // Generation 1 — Grandparents (father's side)
    await addPerson('maksud', 'Максуд', 'Рустамов', null, null, 'male',
      null, false, null, 'https://randomuser.me/api/portraits/men/72.jpg',
      'Глава семьи Рустамовых. Точные годы жизни неизвестны.');
    await addPerson('nasiba', 'Насиба', 'Рустамова', 'Тахировна', null, 'female',
      null, false, null, 'https://randomuser.me/api/portraits/women/72.jpg',
      null);

    // Generation 1 — Grandparents (mother's side)
    await addPerson('hamid', 'Хамид', 'Усманов', 'Гулямович', null, 'male',
      1930, false, null, null,
      'Глава семьи Усмановых. Родился в 1930 году.');
    await addPerson('salomat', 'Саломат', 'Усманова', null, null, 'female',
      1932, false, null, null, null);

    // Generation 2 — Parents
    await addPerson('shahzod', 'Шахзод', 'Рустамов', 'Максудович', null, 'male',
      1954, true, null, 'https://randomuser.me/api/portraits/men/45.jpg',
      null);
    await addPerson('muattar', 'Муаттар', 'Рустамова', 'Хамитовна', 'Усманова', 'female',
      1956, true, null, 'https://randomuser.me/api/portraits/women/45.jpg',
      null);

    // Generation 3 — Children + spouses
    await addPerson('nigora', 'Нигора', 'Рахимова', null, 'Рустамова', 'female',
      1982, true, null, null, null);
    await addPerson('ulugbek', 'Улугбек', 'Рустамов', null, null, 'male',
      1984, true, null, 'https://randomuser.me/api/portraits/men/32.jpg',
      null);
    await addPerson('alisher', 'Алишер', 'Рустамов', null, null, 'male',
      1987, false, 2009, null, null);
    await addPerson('nigora2', 'Нигора', 'Исаева', null, null, 'female',
      1988, true, null, null,
      'Текущая жена Улугбека Рустамова.');
    await addPerson('malika', 'Малика', null, null, null, 'female',
      1989, true, null, null,
      'Первая жена Улугбека Рустамова. В разводе.');
    await addPerson('nodir', 'Нодир', 'Усманов', 'Хашимов', null, 'male',
      null, true, null, null, null);

    console.log('  👥 12 persons created');

    // 4. Set tree owner
    await client.query(
      'UPDATE trees SET owner_person_id = $1 WHERE id = $2',
      [persons['ulugbek'], treeId]
    );
    console.log('  👑 Owner set to Улугбек');

    // 5. Create relationships
    async function addCouple(p1: string, p2: string, status: string) {
      await client.query(
        `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status)
         VALUES ($1, 'couple', $2, $3, $4)`,
        [treeId, persons[p1], persons[p2], status]
      );
    }

    async function addParentChild(parent: string, child: string, childType: string = 'biological') {
      await client.query(
        `INSERT INTO relationships (tree_id, category, person1_id, person2_id, child_relation)
         VALUES ($1, 'parent_child', $2, $3, $4)`,
        [treeId, persons[parent], persons[child], childType]
      );
    }

    // Couples (5)
    await addCouple('maksud', 'nasiba', 'married');
    await addCouple('hamid', 'salomat', 'married');
    await addCouple('shahzod', 'muattar', 'married');
    await addCouple('ulugbek', 'nigora2', 'married');
    await addCouple('ulugbek', 'malika', 'divorced');

    // Parent-child (12)
    await addParentChild('maksud', 'shahzod');
    await addParentChild('nasiba', 'shahzod');
    await addParentChild('hamid', 'muattar');
    await addParentChild('salomat', 'muattar');
    await addParentChild('shahzod', 'nigora');
    await addParentChild('muattar', 'nigora');
    await addParentChild('shahzod', 'ulugbek');
    await addParentChild('muattar', 'ulugbek');
    await addParentChild('shahzod', 'alisher');
    await addParentChild('muattar', 'alisher');
    await addParentChild('shahzod', 'nodir');
    await addParentChild('muattar', 'nodir');

    console.log('  🔗 17 relationships created (5 couples + 12 parent-child)');

    await client.query('COMMIT');
    console.log('\n✅ Seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
