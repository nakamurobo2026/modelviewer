const SEED_RECORDS = [
  {
    "date": "2026-02-02",
    "name": "ラワンベニヤ 5.5x3x6",
    "qty": 1,
    "unitPrice": 1300,
    "amount": 1300,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-10",
    "name": "L/C(フブル材) 30x3x6",
    "qty": 1,
    "unitPrice": 4420,
    "amount": 4420,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-10",
    "name": "L/C(フブル材) 15x3x6",
    "qty": 2,
    "unitPrice": 2250,
    "amount": 4500,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-12",
    "name": "L/C(フブル材) 30x4x8",
    "qty": 2,
    "unitPrice": 7410,
    "amount": 14820,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-12",
    "name": "L/C(フブル材) 21x3x6",
    "qty": 1,
    "unitPrice": 3060,
    "amount": 3060,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-12",
    "name": "糸パッツ SCP 1200x50m",
    "qty": 1,
    "unitPrice": 4750,
    "amount": 4750,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-17",
    "name": "ジナパック #400 1200x42M",
    "qty": 1,
    "unitPrice": 2100,
    "amount": 2100,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-18",
    "name": "L/C(フブル材) 21x3x6",
    "qty": 1,
    "unitPrice": 3060,
    "amount": 3060,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-18",
    "name": "L/C(フブル材) 30x3x6",
    "qty": 1,
    "unitPrice": 4420,
    "amount": 4420,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-18",
    "name": "L/C(フブル材) 24x4x8",
    "qty": 1,
    "unitPrice": 5980,
    "amount": 5980,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-27",
    "name": "ジナベニヤ 9x3x6",
    "qty": 1,
    "unitPrice": 4600,
    "amount": 4600,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-02-27",
    "name": "L/C(フブル材) 21x4x8",
    "qty": 1,
    "unitPrice": 5100,
    "amount": 5100,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-09",
    "name": "ゴム集成 25x300x3000",
    "qty": 2,
    "unitPrice": 9340,
    "amount": 18680,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-09",
    "name": "ゴム集成 25x350x3000",
    "qty": 4,
    "unitPrice": 12290,
    "amount": 49160,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-11",
    "name": "L/C(フブル材) 30x3x6",
    "qty": 3,
    "unitPrice": 4420,
    "amount": 13260,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-11",
    "name": "L/C(フブル材) 24x3x6",
    "qty": 1,
    "unitPrice": 3450,
    "amount": 3450,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-11",
    "name": "L/C(フブル材) 15x3x6",
    "qty": 1,
    "unitPrice": 2250,
    "amount": 2250,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-11",
    "name": "L/C(フブル材) 18x3x6",
    "qty": 1,
    "unitPrice": 2550,
    "amount": 2550,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-11",
    "name": "メルクシパイン B 25x500x4200",
    "qty": 9,
    "unitPrice": 8040,
    "amount": 72360,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-25",
    "name": "N1092N 50R",
    "qty": 20,
    "unitPrice": 650,
    "amount": 13000,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-03-26",
    "name": "MDF 30x4x8",
    "qty": 2,
    "unitPrice": 12640,
    "amount": 25280,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-14",
    "name": "ラワンベニヤ 5.5x4x8",
    "qty": 12,
    "unitPrice": 2820,
    "amount": 33840,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-14",
    "name": "MDF 30x4x8",
    "qty": 1,
    "unitPrice": 12640,
    "amount": 12640,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-16",
    "name": "ラワンベニヤ 24x4x8",
    "qty": 1,
    "unitPrice": 13000,
    "amount": 13000,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-17",
    "name": "MDF 30x4x8",
    "qty": 1,
    "unitPrice": 12640,
    "amount": 12640,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-22",
    "name": "ラワンベニヤ 15x4x8",
    "qty": 1,
    "unitPrice": 6630,
    "amount": 6630,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-04-30",
    "name": "L/C(フブル材) 18x4x8",
    "qty": 1,
    "unitPrice": 3680,
    "amount": 3680,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-05-07",
    "name": "ジナパック #400 1200x42M",
    "qty": 1,
    "unitPrice": 2820,
    "amount": 2820,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-05-29",
    "name": "メルクシパイン B 30x500x4200",
    "qty": 2,
    "unitPrice": 9640,
    "amount": 19280,
    "supplier": "ソゴウ"
  },
  {
    "date": "2026-06-04",
    "name": "ジナベニヤ 12x3x6",
    "qty": 1,
    "unitPrice": 5520,
    "amount": 5520,
    "supplier": "ソゴウ"
  }
];