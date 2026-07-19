export type Card = {
  headline: string; // цепляющая первая строка (hook)
  description: string; // продающее описание через выгоды
  priceHint: string; // подсказка по цене / как назначить
  hashtags: string[]; // 5–10 релевантных
  instagramText: string; // готовый пост целиком
  whatsappText: string; // короткий вариант для рассылки
};
