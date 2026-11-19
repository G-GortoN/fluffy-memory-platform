import type { Locale } from './language';

// Only exact starter text has translated copies. Changes made by users or operators keep their authored text.
const starterText = new Map<string, readonly [string, string]>([
  ['陪伴时光 · 全价主粮', ['Everyday Companion · Complete Pet Food', '陪伴時光 · 全營養主糧']],
  ['面向成年猫狗的日常主粮，按物种选择对应规格。请以收到的包装标签为准。', ['Everyday food for adult cats and dogs. Choose the formula for your pet and follow the label on the pack.', '適合成貓及成犬的日常主糧。請按寵物類別選擇，並以收到的包裝標籤為準。']],
  ['日常营养补充品', ['Daily Nutrition Supplement', '日常營養補充品']],
  ['用于日常补充的宠物营养品。购买前请确认适用对象和包装说明。', ['A supplement for everyday pet nutrition. Check which pets it suits and read the package instructions before ordering.', '用於日常補充的寵物營養品。購買前請確認適用對象及包裝說明。']],
  ['月白陶瓷喂食碗', ['Moon White Ceramic Feeding Bowl', '月白陶瓷餵食碗']],
  ['温润陶瓷与稳固的宽底设计，适合放在每天熟悉的用餐角。', ['Smooth ceramic with a wide, stable base for your pet’s usual feeding spot.', '質感溫潤的陶瓷配以穩固闊底，適合放在寵物熟悉的用餐角落。']],
  ['把回忆留住 · 定制相框', ['Memories to Keep · Personalised Photo Frame', '把回憶留住 · 訂製相架']],
  ['上传一张照片或留下刻字，将一起度过的时光放在看得见的地方。', ['Upload a photo or add an engraving to keep a reminder of your time together in sight.', '上載一張相片或刻下文字，把一起度過的時光放在看得見的地方。']],
  ['随身纪念挂饰', ['Memorial Pendant', '隨身紀念掛飾']],
  ['可刻下名字、日期或一句话，日常佩戴，也适合珍藏。', ['Engrave a name, date, or short message to wear every day or keep somewhere special.', '可刻上名字、日期或一句話，適合日常佩戴或珍藏。']],
  ['长伴 · 纪念骨灰盒', ['Always Together · Memorial Urn', '長伴 · 紀念骨灰盅']],
  ['简洁温和的纪念容器。选择规格前请确认实际容量需要，可填写宠物名字或纪念日期。', ['A simple memorial urn. Check the capacity you need before choosing a size, and add your pet’s name or a date if you wish.', '設計簡約的紀念骨灰盅。選擇容量前請先確認所需大小，可填寫寵物名字或紀念日期。']],
  ['成年猫粮 · 1 kg', ['Adult cat food · 1 kg', '成貓糧 · 1 kg']],
  ['成年犬粮 · 2 kg', ['Adult dog food · 2 kg', '成犬糧 · 2 kg']],
  ['宠物营养补充品 · 30 份', ['Pet nutrition supplement · 30 servings', '寵物營養補充品 · 30 份']],
  ['月白 · 250 mL', ['Moon white · 250 mL', '月白 · 250 mL']],
  ['月白 · 500 mL', ['Moon white · 500 mL', '月白 · 500 mL']],
  ['原木色 · 6 寸', ['Natural wood · 6 in', '原木色 · 6 吋']],
  ['原木色 · 8 寸', ['Natural wood · 8 in', '原木色 · 8 吋']],
  ['银色 · 圆形', ['Silver · Round', '銀色 · 圓形']],
  ['米白色 · 300 mL', ['Off-white · 300 mL', '米白色 · 300 mL']],
  ['米白色 · 600 mL', ['Off-white · 600 mL', '米白色 · 600 mL']],
  ['按生命阶段选主粮', ['Choose food for your pet’s life stage', '按生命階段選擇主糧']],
  ['查看包装上的适用年龄、营养说明和喂食指南。', ['Check the age range, nutrition information, and feeding instructions on the pack.', '查看包裝上的適用年齡、營養說明及餵飼指引。']],
  ['记录正在吃的主粮、食量和体重变化。每只猫狗的需求会随年龄、体况和活动量变化，可以把记录带给兽医作为讨论依据。', ['Keep a record of your pet’s food, intake, and weight changes. Needs vary with age, body condition, and activity. Bring the record to your vet for discussion.', '記下寵物現時食用的主糧、食量和體重變化。每隻貓狗的需要會隨年齡、體況及活動量而變，可帶同紀錄與獸醫商量。']],
  ['核对成年宠物主粮的适用范围', ['Check who an adult pet food is meant for', '核對成年寵物主糧的適用範圍']],
  ['根据猫狗的种类核对包装上的适用对象。', ['Check the packaging to make sure the food suits your cat or dog.', '查看包裝列明的適用對象，確認主糧適合你的貓狗。']],
  ['购买时核对物种、适用阶段和营养说明。查看包装的喂食指南，并把食量和体重记录作为复诊时的参考。', ['When buying food, check the species, life stage, and nutrition details. Follow the feeding guide and bring intake and weight records to follow-up visits.', '購買時核對寵物類別、適用階段及營養說明。參考包裝的餵飼指引，並在覆診時帶同食量和體重紀錄。']],
  ['记录幼宠的饮食和体重', ['Track a young pet’s diet and weight', '記錄幼年寵物的飲食和體重']],
  ['生长时期，可以把食量和体重变化一起记录下来。', ['Record food intake and weight changes as your pet grows.', '成長期間，可一併記下食量及體重變化。']],
  ['为幼宠选择包装注明适用于生长阶段的食品。对于品种、预期成体体型或食量有疑问时，可以和兽医一起确认适用的喂养方案。', ['Choose food labelled for growth. If you have questions about breed, expected adult size, or intake, discuss a feeding plan with your vet.', '為幼年寵物選擇包裝標明適合成長階段的食品。如對品種、預期成年體型或食量有疑問，可與獸醫商量合適的餵飼安排。']],
  ['为猫布置容易到达的饮水点', ['Make drinking water easy for your cat to reach', '為貓咪安排容易到達的飲水位置']],
  ['让水碗处在安静、易接近的位置。', ['Put the water bowl in a quiet, easy-to-reach spot.', '把水碗放在安靜、容易接近的位置。']],
  ['观察猫日常的饮水习惯，并留意饮水量或行为的明显变化。整理这些变化，便于与兽医沟通。', ['Watch your cat’s drinking habits, and note significant changes in intake or behaviour to discuss with your vet.', '觀察貓咪平日的飲水習慣，留意飲水量或行為的明顯變化，並記下來與獸醫商量。']],
  ['记录年长宠物的生活变化', ['Keep track of changes as your pet gets older', '記錄年長寵物的日常變化']],
  ['把活动、食欲、体重和平时的行为变化记下来。', ['Note changes in activity, appetite, weight, and everyday behaviour.', '記下活動量、食慾、體重和平日行為的變化。']],
  ['保持水碗、食盆和休息点方便到达。规律记录体重和日常活动，复诊时分享长期变化。', ['Keep water, food, and resting spots within easy reach. Track weight and activity regularly and share longer-term changes at follow-up visits.', '把水碗、食碗和休息位置放在容易到達的地方。定期記錄體重和日常活動，覆診時分享較長期的變化。']],
]);

export function localizeSeedText(value: string, locale: Locale) {
  if (locale === 'zh-CN') return value;
  return starterText.get(value)?.[locale === 'en' ? 0 : 1] ?? value;
}
