'use strict';
// ── HSK 3 HEAD COACH MODULE ───────────────────────────────────────
// Vocabulary bank (300 стандарт үг), Firestore helpers,
// Spaced Repetition, Drill session, Progress tracker

const { dbPersonal } = require('../firebase');

// ── HSK 3 STANDARD VOCABULARY (300 үг) ───────────────────────────
const HSK3_VOCAB = [
  // A
  { word: '啊',    pinyin: 'a',           definition: 'аа (тодруулах дагавар)' },
  { word: '阿姨',  pinyin: 'āyí',         definition: 'хань эгч, нас гүйцсэн эмэгтэй' },
  { word: '矮',    pinyin: 'ǎi',          definition: 'намхан' },
  { word: '爱好',  pinyin: 'àihào',       definition: 'хобби, дуртай зүйл' },
  { word: '安静',  pinyin: 'ānjìng',      definition: 'чимээгүй, тайван' },
  // B
  { word: '把',    pinyin: 'bǎ',          definition: 'объект заах предлог (把…)' },
  { word: '班',    pinyin: 'bān',         definition: 'анги, ажлын бүлэг' },
  { word: '搬',    pinyin: 'bān',         definition: 'зөөх, нүүх' },
  { word: '办公室',pinyin: 'bàngōngshì',  definition: 'оффис, ажлын өрөө' },
  { word: '半',    pinyin: 'bàn',         definition: 'хагас' },
  { word: '帮忙',  pinyin: 'bāngmáng',    definition: 'туслах' },
  { word: '帮助',  pinyin: 'bāngzhù',     definition: 'туслах, тусламж' },
  { word: '包',    pinyin: 'bāo',         definition: 'уут, цүнх' },
  { word: '北方',  pinyin: 'běifāng',     definition: 'хойд зүг, хойд нутаг' },
  { word: '被',    pinyin: 'bèi',         definition: 'идэвхгүй байдлын тэмдэг (被 + үйл үг)' },
  { word: '鼻子',  pinyin: 'bízi',        definition: 'хамар' },
  { word: '比较',  pinyin: 'bǐjiào',      definition: 'харьцуулбал, харьцангуй' },
  { word: '比赛',  pinyin: 'bǐsài',       definition: 'тэмцээн, уралдаан' },
  { word: '必须',  pinyin: 'bìxū',        definition: 'заавал, зайлшгүй' },
  { word: '变化',  pinyin: 'biànhuà',     definition: 'өөрчлөлт, хувирал' },
  { word: '表示',  pinyin: 'biǎoshì',     definition: 'илэрхийлэх, тэмдэглэх' },
  { word: '表演',  pinyin: 'biǎoyǎn',     definition: 'тоглох, үзүүлбэр' },
  { word: '别人',  pinyin: 'biéren',      definition: 'бусад хүн' },
  { word: '冰箱',  pinyin: 'bīngxiāng',   definition: 'хөргөгч' },
  { word: '不但',  pinyin: 'búdàn',       definition: 'зөвхөн биш (не только)' },
  // C
  { word: '才',    pinyin: 'cái',         definition: 'дөнгөж, л (тэгж байж)' },
  { word: '菜单',  pinyin: 'càidān',      definition: 'меню' },
  { word: '参加',  pinyin: 'cānjiā',      definition: 'оролцох' },
  { word: '草',    pinyin: 'cǎo',         definition: 'өвс' },
  { word: '层',    pinyin: 'céng',        definition: 'давхар (тоолох нэгж)' },
  { word: '差',    pinyin: 'chà',         definition: 'муу, дутуу, ялгаа' },
  { word: '超市',  pinyin: 'chāoshì',     definition: 'супермаркет' },
  { word: '衬衫',  pinyin: 'chènshān',    definition: 'цамц' },
  { word: '城市',  pinyin: 'chéngshì',    definition: 'хот' },
  { word: '迟到',  pinyin: 'chídào',      definition: 'хоцрох' },
  { word: '除了',  pinyin: 'chúle',       definition: 'эс тооцвол, …ч гэсэн' },
  { word: '穿',    pinyin: 'chuān',       definition: 'өмсөх' },
  { word: '春',    pinyin: 'chūn',        definition: 'хавар' },
  { word: '词典',  pinyin: 'cídiǎn',      definition: 'толь бичиг' },
  { word: '聪明',  pinyin: 'cōngmíng',    definition: 'ухаантай, авьяастай' },
  { word: '错误',  pinyin: 'cuòwù',       definition: 'алдаа' },
  // D
  { word: '打扫',  pinyin: 'dǎsǎo',       definition: 'цэвэрлэх' },
  { word: '打算',  pinyin: 'dǎsuàn',      definition: 'төлөвлөх, санаа' },
  { word: '带',    pinyin: 'dài',         definition: 'авчрах, дагуулах, зүүх' },
  { word: '担心',  pinyin: 'dānxīn',      definition: 'санаа зовох' },
  { word: '蛋糕',  pinyin: 'dàngāo',      definition: 'бялуу' },
  { word: '当然',  pinyin: 'dāngrán',     definition: 'мэдээж, ойлгомжтой' },
  { word: '地',    pinyin: 'de',          definition: 'үйл үгийг тодруулах de (副词+地+动词)' },
  { word: '登机牌',pinyin: 'dēngjīpái',   definition: 'нислэгт суух тасалбар' },
  { word: '低',    pinyin: 'dī',          definition: 'нам, намхан, бага' },
  { word: '地图',  pinyin: 'dìtú',        definition: 'газрын зураг' },
  { word: '电梯',  pinyin: 'diàntī',      definition: 'лифт' },
  { word: '电子邮件',pinyin:'diànzǐ yóujiàn',definition:'и-мэйл' },
  { word: '东',    pinyin: 'dōng',        definition: 'зүүн зүг' },
  { word: '动物',  pinyin: 'dòngwù',      definition: 'амьтан' },
  { word: '短',    pinyin: 'duǎn',        definition: 'богино' },
  { word: '段',    pinyin: 'duàn',        definition: 'хэсэг, гарц' },
  { word: '锻炼',  pinyin: 'duànliàn',    definition: 'дасгал хийх, биеэ хөгжүүлэх' },
  { word: '多么',  pinyin: 'duōme',       definition: 'ямар их (хэм хэмжээ)' },
  // E
  { word: '而且',  pinyin: 'érqiě',       definition: 'мөн, үүнээс гадна' },
  // F
  { word: '发',    pinyin: 'fā',          definition: 'илгээх, гаргах' },
  { word: '发现',  pinyin: 'fāxiàn',      definition: 'илрүүлэх, олж мэдэх' },
  { word: '方便',  pinyin: 'fāngbiàn',    definition: 'тохиромжтой, хялбар' },
  { word: '方向',  pinyin: 'fāngxiàng',   definition: 'чиглэл' },
  { word: '放',    pinyin: 'fàng',        definition: 'тавих, чөлөөлөх' },
  { word: '放心',  pinyin: 'fàngxīn',     definition: 'санаа амрах, тайвших' },
  { word: '分',    pinyin: 'fēn',         definition: 'минут; оноо; хувааx' },
  { word: '附近',  pinyin: 'fùjìn',       definition: 'ойр орчим' },
  { word: '复习',  pinyin: 'fùxí',        definition: 'давтан судлах' },
  // G
  { word: '干净',  pinyin: 'gānjìng',     definition: 'цэвэр' },
  { word: '感冒',  pinyin: 'gǎnmào',      definition: 'томуу, ханиад' },
  { word: '感情',  pinyin: 'gǎnqíng',     definition: 'мэдрэмж, сэтгэл хөдлөл' },
  { word: '高兴',  pinyin: 'gāoxìng',     definition: 'баяртай, сайхан сэтгэлтэй' },
  { word: '个子',  pinyin: 'gèzi',        definition: 'биеийн өндөр' },
  { word: '根据',  pinyin: 'gēnjù',       definition: '…-д үндэслэн' },
  { word: '更',    pinyin: 'gèng',        definition: 'улам, бүр ч' },
  { word: '故事',  pinyin: 'gùshi',       definition: 'түүх, үлгэр' },
  { word: '关系',  pinyin: 'guānxi',      definition: 'харилцаа, хамаарал' },
  { word: '关心',  pinyin: 'guānxīn',     definition: 'анхаарах, халамжлах' },
  { word: '关于',  pinyin: 'guānyú',      definition: '…-ийн тухай' },
  { word: '国际',  pinyin: 'guójì',       definition: 'олон улсын' },
  { word: '过',    pinyin: 'guò',         definition: 'өнгөрөх; туршлага дагавар (-過)' },
  // H
  { word: '还是',  pinyin: 'háishi',      definition: 'эсвэл; харин л' },
  { word: '害怕',  pinyin: 'hàipà',       definition: 'айх' },
  { word: '黑板',  pinyin: 'hēibǎn',      definition: 'самбар' },
  { word: '后来',  pinyin: 'hòulái',      definition: 'дараа нь, хожим нь' },
  { word: '护照',  pinyin: 'hùzhào',      definition: 'паспорт' },
  { word: '花',    pinyin: 'huā',         definition: 'цэцэг; зарцуулах (мөнгө/цаг)' },
  { word: '画',    pinyin: 'huà',         definition: 'зурах, зураг' },
  { word: '坏',    pinyin: 'huài',        definition: 'муу, эвдэрсэн' },
  { word: '欢迎',  pinyin: 'huānyíng',    definition: 'тавтай морил' },
  { word: '换',    pinyin: 'huàn',        definition: 'солих' },
  { word: '回答',  pinyin: 'huídá',       definition: 'хариу өгөх' },
  { word: '会议',  pinyin: 'huìyì',       definition: 'хурал' },
  { word: '活动',  pinyin: 'huódòng',     definition: 'үйл ажиллагаа; хөдлөх' },
  { word: '火',    pinyin: 'huǒ',         definition: 'гал' },
  // J
  { word: '几乎',  pinyin: 'jīhū',        definition: 'бараг' },
  { word: '机会',  pinyin: 'jīhuì',       definition: 'боломж' },
  { word: '季节',  pinyin: 'jìjié',       definition: 'улирал' },
  { word: '记得',  pinyin: 'jìde',        definition: 'санаж байгаа' },
  { word: '检查',  pinyin: 'jiǎnchá',     definition: 'шалгах' },
  { word: '简单',  pinyin: 'jiǎndān',     definition: 'энгийн, хялбар' },
  { word: '健康',  pinyin: 'jiànkāng',    definition: 'эрүүл мэнд; эрүүл' },
  { word: '见面',  pinyin: 'jiànmiàn',    definition: 'уулзах' },
  { word: '讲',    pinyin: 'jiǎng',       definition: 'ярих, тайлбарлах' },
  { word: '教',    pinyin: 'jiāo',        definition: 'заах' },
  { word: '教室',  pinyin: 'jiàoshì',     definition: 'анги тасалгаа' },
  { word: '结婚',  pinyin: 'jiéhūn',      definition: 'гэрлэх' },
  { word: '结束',  pinyin: 'jiéshù',      definition: 'дуусах, дуусгах' },
  { word: '节目',  pinyin: 'jiémù',       definition: 'нэвтрүүлэг, программ' },
  { word: '节日',  pinyin: 'jiérì',       definition: 'баяр тэмдэглэлт өдөр' },
  { word: '经常',  pinyin: 'jīngcháng',   definition: 'байнга, ихэвчлэн' },
  { word: '经过',  pinyin: 'jīngguò',     definition: 'дайрч өнгөрөх; туулах' },
  { word: '经理',  pinyin: 'jīnglǐ',      definition: 'менежер, захирал' },
  { word: '句子',  pinyin: 'jùzi',        definition: 'өгүүлбэр' },
  { word: '决定',  pinyin: 'juédìng',     definition: 'шийдэх, шийдвэр' },
  // K
  { word: '可爱',  pinyin: "kě'ài",       definition: 'гоё, хөгжилтэй, дур булаам' },
  { word: '刻',    pinyin: 'kè',          definition: '15 минут; сийлэх' },
  { word: '客人',  pinyin: 'kèrén',       definition: 'зочин' },
  { word: '空调',  pinyin: 'kōngtiáo',    definition: 'кондиционер' },
  { word: '口',    pinyin: 'kǒu',         definition: 'ам; гэр бүлийн тоолох нэгж' },
  { word: '哭',    pinyin: 'kū',          definition: 'уйлах' },
  { word: '裤子',  pinyin: 'kùzi',        definition: 'өмд' },
  { word: '筷子',  pinyin: 'kuàizi',      definition: 'таяк (хятад)' },
  // L
  { word: '来不及',pinyin: 'láibùjí',     definition: 'цаг хүрэхгүй байна' },
  { word: '来得及',pinyin: 'láidejí',     definition: 'цаг хүрнэ, амжина' },
  { word: '老',    pinyin: 'lǎo',         definition: 'хөгшин; хүндэтгэлийн угтвар' },
  { word: '离',    pinyin: 'lí',          definition: '…-аас (зай зөрүү)' },
  { word: '礼物',  pinyin: 'lǐwù',        definition: 'бэлэг' },
  { word: '历史',  pinyin: 'lìshǐ',       definition: 'түүх' },
  { word: '脸',    pinyin: 'liǎn',        definition: 'нүүр' },
  { word: '练习',  pinyin: 'liànxí',      definition: 'дасгалжих, дадлага' },
  { word: '了解',  pinyin: 'liǎojiě',     definition: 'ойлгох, мэдэх' },
  { word: '邻居',  pinyin: 'línjū',       definition: 'хөрш' },
  { word: '留学',  pinyin: 'liúxué',      definition: 'гадаадад суралцах' },
  { word: '楼',    pinyin: 'lóu',         definition: 'байшин, давхар' },
  { word: '绿',    pinyin: 'lǜ',          definition: 'ногоон' },
  // M
  { word: '马上',  pinyin: 'mǎshàng',     definition: 'тэр дороо, нэн даруй' },
  { word: '满意',  pinyin: 'mǎnyì',       definition: 'сэтгэл ханах' },
  { word: '帽子',  pinyin: 'màozi',       definition: 'малгай' },
  { word: '面包',  pinyin: 'miànbāo',     definition: 'талх' },
  { word: '明白',  pinyin: 'míngbái',     definition: 'ойлгох; тод' },
  // N
  { word: '拿',    pinyin: 'ná',          definition: 'авах, барих' },
  { word: '奶奶',  pinyin: 'nǎinai',      definition: 'эмэг эх' },
  { word: '南',    pinyin: 'nán',         definition: 'өмнөд зүг' },
  { word: '难',    pinyin: 'nán',         definition: 'хэцүү' },
  { word: '年级',  pinyin: 'niánjí',      definition: 'анги (сургуулийн)' },
  { word: '年轻',  pinyin: 'niánqīng',    definition: 'залуу' },
  { word: '努力',  pinyin: 'nǔlì',        definition: 'хичээх, хөдөлмөрлөх' },
  { word: '暖和',  pinyin: 'nuǎnhuo',     definition: 'дулаан' },
  // P
  { word: '爬山',  pinyin: 'páshān',      definition: 'уул авирах' },
  { word: '盘子',  pinyin: 'pánzi',       definition: 'таваг' },
  { word: '胖',    pinyin: 'pàng',        definition: 'таргалах, бүдүүн' },
  { word: '皮鞋',  pinyin: 'píxié',       definition: 'арьсан гутал' },
  { word: '啤酒',  pinyin: 'píjiǔ',       definition: 'шар айраг' },
  { word: '普通话',pinyin: 'pǔtōnghuà',   definition: 'стандарт хятад хэл' },
  // Q
  { word: '其实',  pinyin: 'qíshí',       definition: 'үнэндээ' },
  { word: '其他',  pinyin: 'qítā',        definition: 'бусад, бусад зүйл' },
  { word: '奇怪',  pinyin: 'qíguài',      definition: 'хачин, гайхалтай' },
  { word: '清楚',  pinyin: 'qīngchǔ',     definition: 'тодорхой, ойлгомжтой' },
  { word: '请假',  pinyin: 'qǐngjià',     definition: 'чөлөө авах' },
  { word: '秋',    pinyin: 'qiū',         definition: 'намар' },
  // R
  { word: '然后',  pinyin: 'ránhòu',      definition: 'дараа нь, тэгэхэд' },
  { word: '热情',  pinyin: 'rèqíng',      definition: 'урам зориг, халуун сэтгэл' },
  { word: '认为',  pinyin: 'rènwéi',      definition: 'гэж үзэх, боддог' },
  { word: '认真',  pinyin: 'rènzhēn',     definition: 'нухацтай, анхааралтай' },
  { word: '日记',  pinyin: 'rìjì',        definition: 'өдрийн тэмдэглэл' },
  { word: '容易',  pinyin: 'róngyì',      definition: 'хялбар' },
  // S
  { word: '伞',    pinyin: 'sǎn',         definition: 'шүхэр' },
  { word: '上网',  pinyin: 'shàngwǎng',   definition: 'интернэт хэрэглэх' },
  { word: '生气',  pinyin: 'shēngqì',     definition: 'уурлах' },
  { word: '声音',  pinyin: 'shēngyīn',    definition: 'дуу чимээ' },
  { word: '使',    pinyin: 'shǐ',         definition: 'болгох, ашиглуулах' },
  { word: '世界',  pinyin: 'shìjiè',      definition: 'дэлхий' },
  { word: '事情',  pinyin: 'shìqing',     definition: 'хэрэг, зүйл, асуудал' },
  { word: '试',    pinyin: 'shì',         definition: 'туршиж үзэх' },
  { word: '舒服',  pinyin: 'shūfu',       definition: 'тав тухтай, амгалан' },
  { word: '树',    pinyin: 'shù',         definition: 'мод' },
  { word: '数学',  pinyin: 'shùxué',      definition: 'математик' },
  { word: '刷牙',  pinyin: 'shuāyá',      definition: 'шүдээ угаах' },
  { word: '双',    pinyin: 'shuāng',      definition: 'хос, хоёр' },
  { word: '水平',  pinyin: 'shuǐpíng',    definition: 'түвшин, чадвар' },
  { word: '司机',  pinyin: 'sījī',        definition: 'жолооч' },
  { word: '送',    pinyin: 'sòng',        definition: 'дагуулж өгөх; бэлэглэх' },
  { word: '虽然',  pinyin: 'suīrán',      definition: 'хэдий тийм боловч' },
  { word: '速度',  pinyin: 'sùdù',        definition: 'хурд' },
  // T
  { word: '特别',  pinyin: 'tèbié',       definition: 'онцгой, ялангуяа' },
  { word: '提高',  pinyin: 'tígāo',       definition: 'дээшлүүлэх' },
  { word: '体育',  pinyin: 'tǐyù',        definition: 'биеийн тамир' },
  { word: '甜',    pinyin: 'tián',        definition: 'чихэрлэг, амттай' },
  { word: '条',    pinyin: 'tiáo',        definition: 'урт нарийн зүйлийн нэгж' },
  { word: '跳舞',  pinyin: 'tiàowǔ',      definition: 'бүжиглэх' },
  { word: '同情',  pinyin: 'tóngqíng',    definition: 'өрөвдөх' },
  { word: '同事',  pinyin: 'tóngshì',     definition: 'хамт ажиллагч' },
  { word: '同意',  pinyin: 'tóngyì',      definition: 'зөвшөөрөх' },
  { word: '突然',  pinyin: 'tūrán',       definition: 'гэнэт, нэнт' },
  // W
  { word: '完成',  pinyin: 'wánchéng',    definition: 'дуусгах, биелүүлэх' },
  { word: '碗',    pinyin: 'wǎn',         definition: 'аяга' },
  { word: '万',    pinyin: 'wàn',         definition: '10,000 (арван мянга)' },
  { word: '往',    pinyin: 'wǎng',        definition: '…рүү (чиглэл)' },
  { word: '为了',  pinyin: 'wèile',       definition: '…-ийн тулд' },
  { word: '位',    pinyin: 'wèi',         definition: 'хүндэтгэлийн тоолох нэгж' },
  { word: '文化',  pinyin: 'wénhuà',      definition: 'соёл' },
  { word: '文章',  pinyin: 'wénzhāng',    definition: 'нийтлэл, эссе' },
  { word: '问题',  pinyin: 'wèntí',       definition: 'асуулт; асуудал' },
  // X
  { word: '西',    pinyin: 'xī',          definition: 'баруун зүг' },
  { word: '习惯',  pinyin: 'xíguàn',      definition: 'зуршил; дасах' },
  { word: '洗手间',pinyin: 'xǐshǒujiān',  definition: 'угаалгын өрөө' },
  { word: '洗澡',  pinyin: 'xǐzǎo',       definition: 'усанд орох' },
  { word: '先生',  pinyin: 'xiānsheng',   definition: 'ноён, нөхөр (хүндэтгэл)' },
  { word: '相信',  pinyin: 'xiāngxìn',    definition: 'итгэх' },
  { word: '小心',  pinyin: 'xiǎoxīn',     definition: 'болгоомжтой байх' },
  { word: '校长',  pinyin: 'xiàozhǎng',   definition: 'сургуулийн захирал' },
  { word: '心情',  pinyin: 'xīnqíng',     definition: 'сэтгэл санаа' },
  { word: '行李箱',pinyin: 'xínglǐxiāng', definition: 'аялалын цүнх' },
  { word: '熊猫',  pinyin: 'xióngmāo',    definition: 'панда баавгай' },
  { word: '需要',  pinyin: 'xūyào',       definition: 'хэрэгтэй, шаардлагатай' },
  { word: '选择',  pinyin: 'xuǎnzé',      definition: 'сонгох, сонголт' },
  // Y
  { word: '眼镜',  pinyin: 'yǎnjìng',     definition: 'нүдний шил' },
  { word: '要求',  pinyin: 'yāoqiú',      definition: 'шаардах, шаардлага' },
  { word: '一般',  pinyin: 'yìbān',       definition: 'энгийн, ерөнхий' },
  { word: '一共',  pinyin: 'yígòng',      definition: 'нийт, бүгдээрэ' },
  { word: '一直',  pinyin: 'yīzhí',       definition: 'үргэлж, шулуухан' },
  { word: '以为',  pinyin: 'yǐwéi',       definition: 'гэж бодсон (буруу байсан)' },
  { word: '音乐',  pinyin: 'yīnyuè',      definition: 'хөгжим' },
  { word: '银行',  pinyin: 'yínháng',     definition: 'банк' },
  { word: '应该',  pinyin: 'yīnggāi',     definition: 'ёстой, хэрэгтэй' },
  { word: '影响',  pinyin: 'yǐngxiǎng',   definition: 'нөлөөлөх, нөлөө' },
  { word: '用',    pinyin: 'yòng',        definition: 'ашиглах, хэрэглэх' },
  { word: '游泳',  pinyin: 'yóuyǒng',     definition: 'усанд сэлэх' },
  { word: '有名',  pinyin: 'yǒumíng',     definition: 'алдартай' },
  { word: '又',    pinyin: 'yòu',         definition: 'дахин, мөн' },
  { word: '右边',  pinyin: 'yòubiān',     definition: 'баруун тал' },
  { word: '遇到',  pinyin: 'yùdào',       definition: 'тааралдах, учрах' },
  { word: '愿意',  pinyin: 'yuànyì',      definition: 'зөвшөөрөх, хүсэх' },
  { word: '月亮',  pinyin: 'yuèliang',    definition: 'сар' },
  { word: '运动',  pinyin: 'yùndòng',     definition: 'спорт, хөдөлгөөн' },
  // Z
  { word: '站',    pinyin: 'zhàn',        definition: 'зогсох; буудал' },
  { word: '着急',  pinyin: 'zháojí',      definition: 'яарах, сандрах' },
  { word: '照顾',  pinyin: 'zhàogu',      definition: 'асрах, анхаарах' },
  { word: '照片',  pinyin: 'zhàopiàn',    definition: 'зураг (гэрэл)' },
  { word: '终于',  pinyin: 'zhōngyú',     definition: 'эцэст нь, аргагүй' },
  { word: '中间',  pinyin: 'zhōngjiān',   definition: 'дунд' },
  { word: '中文',  pinyin: 'Zhōngwén',    definition: 'хятад хэл (бичиг)' },
  { word: '重要',  pinyin: 'zhòngyào',    definition: 'чухал' },
  { word: '周末',  pinyin: 'zhōumò',      definition: 'амралтын өдрүүд' },
  { word: '主要',  pinyin: 'zhǔyào',      definition: 'гол, үндсэн' },
  { word: '注意',  pinyin: 'zhùyì',       definition: 'анхаарах, сонор байх' },
  { word: '准备',  pinyin: 'zhǔnbèi',     definition: 'бэлдэх, бэлтгэх' },
  { word: '自己',  pinyin: 'zìjǐ',        definition: 'өөрөө' },
  { word: '总是',  pinyin: 'zǒngshì',     definition: 'үргэлж' },
  { word: '左边',  pinyin: 'zuǒbiān',     definition: 'зүүн тал' },
  { word: '最后',  pinyin: 'zuìhòu',      definition: 'эцэст нь, хамгийн сүүлд' },
  { word: '最近',  pinyin: 'zuìjìn',      definition: 'сүүлд, саяхан' },
  { word: '作业',  pinyin: 'zuòyè',       definition: 'гэрийн даалгавар' },
];

// ── FIRESTORE HELPERS ─────────────────────────────────────────────

// Vocab бүгдийг seed хийх (нэг удаа, эсвэл шинэчлэх)
async function seedVocab(uid) {
  const col = dbPersonal.collection(`users/${uid}/vocabulary`);
  const snap = await col.limit(1).get();
  if (!snap.empty) return snap.size; // аль хэдийн seed хийгдсэн

  const batch = dbPersonal.batch();
  HSK3_VOCAB.forEach(v => {
    const ref = col.doc(encodeWord(v.word));
    batch.set(ref, {
      word:          v.word,
      pinyin:        v.pinyin,
      definition:    v.definition,
      mastery_level: 1,
      last_reviewed: null,
      correct_count: 0,
      wrong_count:   0,
      addedAt:       new Date().toISOString(),
    });
  });
  await batch.commit();
  console.log(`[HSK Coach] ${HSK3_VOCAB.length} үг seed хийлээ → users/${uid}/vocabulary`);
  return HSK3_VOCAB.length;
}

// URL-safe word ID
function encodeWord(w) {
  return Buffer.from(w).toString('base64').replace(/[/+=]/g, c =>
    c === '/' ? '_' : c === '+' ? '-' : '.');
}

// Spaced Repetition: mastery_level → хэдэн өдрийн дараа давтах
const SRS_INTERVAL = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 14 };

// Өнөөдөр давтах ёстой үгсийг авах (SRS + масtery_level ASC)
async function getWeakWords(uid, limit = 10) {
  try {
    const snap = await dbPersonal.collection(`users/${uid}/vocabulary`).get();
    if (snap.empty) return [];

    const now   = Date.now();
    const words = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // SRS filter: last_reviewed + interval хугацаа өнгөрсөн
    const due = words.filter(w => {
      if (!w.last_reviewed) return true;  // шинэ үг → хамгийн тэргүүнд
      const interval = SRS_INTERVAL[w.mastery_level] || 1;
      const nextReview = new Date(w.last_reviewed).getTime() + interval * 86400000;
      return now >= nextReview;
    });

    // mastery_level бага → тэргүүнд, дараа нь last_reviewed хуучин нь
    due.sort((a, b) => {
      if (a.mastery_level !== b.mastery_level) return a.mastery_level - b.mastery_level;
      if (!a.last_reviewed) return -1;
      if (!b.last_reviewed) return 1;
      return new Date(a.last_reviewed) - new Date(b.last_reviewed);
    });

    return due.slice(0, limit);
  } catch (e) {
    console.error('[HSK] getWeakWords error:', e.message);
    return [];
  }
}

// Mastery шинэчлэх
async function updateMastery(wordStr, correct, uid) {
  try {
    const id   = encodeWord(wordStr);
    const ref  = dbPersonal.doc(`users/${uid}/vocabulary/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return;

    const d   = snap.data();
    let level = d.mastery_level || 1;
    level = correct ? Math.min(5, level + 1) : Math.max(1, level - 1);

    await ref.update({
      mastery_level:  level,
      last_reviewed:  new Date().toISOString(),
      correct_count: (d.correct_count || 0) + (correct ? 1 : 0),
      wrong_count:   (d.wrong_count   || 0) + (correct ? 0 : 1),
    });
    return level;
  } catch (e) {
    console.error('[HSK] updateMastery error:', e.message);
    return null;
  }
}

// Progress статистик
async function getProgress(uid) {
  try {
    const snap = await dbPersonal.collection(`users/${uid}/vocabulary`).get();
    if (snap.empty) return null;

    const total = snap.size;
    const dist  = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    snap.docs.forEach(d => {
      const lv = d.data().mastery_level || 1;
      dist[lv] = (dist[lv] || 0) + 1;
    });

    const mastered = dist[5];
    const pct      = Math.round(mastered / total * 100);

    // HSK 3 шалгалтын огноо (2026/06/28)
    const examDate  = new Date('2026-06-28T09:00:00+08:00');
    const daysLeft  = Math.ceil((examDate - Date.now()) / 86400000);
    const dailyGoal = Math.ceil((total - mastered) / Math.max(daysLeft, 1));

    return { total, dist, mastered, pct, daysLeft, dailyGoal };
  } catch (e) {
    console.error('[HSK] getProgress error:', e.message);
    return null;
  }
}

// ── DRILL SESSION ─────────────────────────────────────────────────
async function getDrillSession(uid) {
  try {
    const snap = await dbPersonal.doc(`users/${uid}/hsk/session`).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

async function saveDrillSession(session, uid) {
  try {
    await dbPersonal.doc(`users/${uid}/hsk/session`).set(
      { ...session, updatedAt: new Date().toISOString() }
    );
  } catch {}
}

async function clearDrillSession(uid) {
  try {
    await dbPersonal.doc(`users/${uid}/hsk/session`).delete();
  } catch {}
}

module.exports = {
  HSK3_VOCAB,
  seedVocab,
  getWeakWords,
  updateMastery,
  getProgress,
  getDrillSession,
  saveDrillSession,
  clearDrillSession,
};
