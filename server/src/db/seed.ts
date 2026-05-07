import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../../.env') });

import { pool } from './pool.js';

async function seed() {
  await pool.query(`TRUNCATE relationships, persons, trees, users RESTART IDENTITY CASCADE`);

  // Owner user
  const u = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, display_name) VALUES ('+998900000001', 'Улугбек') RETURNING id`
  );
  const userId = u.rows[0].id;

  // Tree
  const t = await pool.query<{ id: string }>(
    `INSERT INTO trees (user_id, name) VALUES ($1, 'Семья Рустамовых-Каримовых') RETURNING id`,
    [userId]
  );
  const treeId = t.rows[0].id;

  const P = (
    firstName: string,
    lastName: string,
    gender: 'male' | 'female',
    birthYear: number,
    opts: Partial<{ middleName: string; maidenName: string; deathYear: number; verified: boolean }> = {}
  ) =>
    pool
      .query<{ id: string }>(
        `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender, birth_year, is_alive, death_year, verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          treeId,
          firstName,
          lastName,
          opts.middleName ?? null,
          opts.maidenName ?? null,
          gender,
          birthYear,
          opts.deathYear ? false : true,
          opts.deathYear ?? null,
          opts.verified ?? false,
        ]
      )
      .then((r) => r.rows[0].id);

  // G-3 (4 deceased)
  const yusuf = await P('Юсуф', 'Рустамов', 'male', 1900, { deathYear: 1972 });
  const zulayho = await P('Зулайхо', 'Хайдарова', 'female', 1908, { deathYear: 1985 });
  const tursun = await P('Турсун', 'Каримов', 'male', 1898, { deathYear: 1967 });
  const hosiyat = await P('Хосият', 'Юлдашева', 'female', 1902, { deathYear: 1980 });

  // G-2
  const karim = await P('Карим', 'Рустамов', 'male', 1948, { deathYear: 2010, verified: true });
  const muhabbat = await P('Мухаббат', 'Усманова', 'female', 1952, { verified: true });
  const jalol = await P('Жалол', 'Каримов', 'male', 1945, { verified: true });
  const adolat = await P('Адолат', 'Турсунова', 'female', 1950, { verified: true });

  // G-1
  const feruza = await P('Феруза', 'Алиева', 'female', 1965, { maidenName: 'Рустамова', verified: true });
  const shavkat = await P('Шавкат', 'Алиев', 'male', 1962);
  const jasur = await P('Жасур', 'Рустамов', 'male', 1972, { verified: true });
  const dilfuza = await P('Дилфуза', 'Каюмова', 'female', 1975);
  const samvat = await P('Самват', 'Рустамов', 'male', 1968, { verified: true });
  const lola = await P('Лола', 'Каримова', 'female', 1970, { maidenName: 'Каримова', verified: true });
  const bahtior = await P('Бахтиёр', 'Каримов', 'male', 1968, { verified: true });
  const nodira = await P('Нодира', 'Хасанова', 'female', 1972);

  // G0
  const ulugbek = await P('Улугбек', 'Рустамов', 'male', 1984, { middleName: "Самват o'g'li", verified: true });
  const nigora = await P('Нигора', 'Усманова', 'female', 1986);
  const rustam = await P('Рустам', 'Рустамов', 'male', 1988, { middleName: "Самват o'g'li", verified: true });
  const malika = await P('Малика', 'Хасанова', 'female', 1990);
  const zarina = await P('Зарина', 'Носирова', 'female', 1986, { maidenName: 'Рустамова', verified: true });
  const timur = await P('Тимур', 'Носиров', 'male', 1984);
  const madina = await P('Мадина', 'Алиева', 'female', 1990);
  const aziz = await P('Азиз', 'Рустамов', 'male', 1996);
  const kamron = await P('Камрон', 'Каримов', 'male', 1995);

  // G+1
  const sardor = await P('Сардор', 'Носиров', 'male', 2014);
  const bek = await P('Бек', 'Рустамов', 'male', 2015);
  const aziza = await P('Азиза', 'Рустамова', 'female', 2018);
  const nodir = await P('Нодир', 'Рустамов', 'male', 2018);
  const leyla = await P('Лейла', 'Рустамова', 'female', 2020);

  // Owner pointer
  await pool.query(`UPDATE trees SET owner_person_id = $1 WHERE id = $2`, [ulugbek, treeId]);

  // Relationships
  const C = (a: string, b: string, status = 'married') =>
    pool.query(
      `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status) VALUES ($1, 'couple', $2, $3, $4)`,
      [treeId, a, b, status]
    );
  const PC = (parent: string, child: string) =>
    pool.query(
      `INSERT INTO relationships (tree_id, category, person1_id, person2_id, child_relation) VALUES ($1, 'parent_child', $2, $3, 'biological')`,
      [treeId, parent, child]
    );

  // Couples
  await C(yusuf, zulayho);
  await C(tursun, hosiyat);
  await C(karim, muhabbat);
  await C(jalol, adolat);
  await C(feruza, shavkat);
  await C(jasur, dilfuza);
  await C(samvat, lola);
  await C(bahtior, nodira);
  await C(ulugbek, nigora);
  await C(rustam, malika);
  await C(zarina, timur);

  // Parent-child G-3 → G-2
  await PC(yusuf, karim);
  await PC(zulayho, karim);
  await PC(tursun, jalol);
  await PC(hosiyat, jalol);

  // G-2 → G-1
  await PC(karim, feruza);
  await PC(muhabbat, feruza);
  await PC(karim, samvat);
  await PC(muhabbat, samvat);
  await PC(karim, jasur);
  await PC(muhabbat, jasur);
  await PC(jalol, lola);
  await PC(adolat, lola);
  await PC(jalol, bahtior);
  await PC(adolat, bahtior);

  // G-1 → G0
  await PC(feruza, madina);
  await PC(shavkat, madina);
  await PC(jasur, aziz);
  await PC(dilfuza, aziz);
  await PC(samvat, ulugbek);
  await PC(lola, ulugbek);
  await PC(samvat, rustam);
  await PC(lola, rustam);
  await PC(samvat, zarina);
  await PC(lola, zarina);
  await PC(bahtior, kamron);
  await PC(nodira, kamron);

  // G0 → G+1
  await PC(zarina, sardor);
  await PC(timur, sardor);
  await PC(ulugbek, bek);
  await PC(nigora, bek);
  await PC(ulugbek, aziza);
  await PC(nigora, aziza);
  await PC(rustam, nodir);
  await PC(malika, nodir);
  await PC(rustam, leyla);
  await PC(malika, leyla);

  console.log('[seed] done — 30 persons, 11 couples, ~30 parent-child rels');
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
