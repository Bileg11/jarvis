'use strict';
// ── HSK 3 HEAD COACH MODULE ───────────────────────────────────────
// Vocabulary bank (300 стандарт үг), Firestore helpers,
// Spaced Repetition, Drill session, Progress tracker

const { dbPersonal } = require('../firebase');

// ── HSK 3 STANDARD VOCABULARY (300 үг) ───────────────────────────
const HSK3_VOCAB = [
  { word: "阿姨", pinyin: "āyí", definition: "эмэгтэй авга, тётя", en: "aunt; auntie" },
  { word: "啊", pinyin: "a", definition: "аа (мэдрэмж тэмдэглэгээ)", en: "particle: surprise/agreement" },
  { word: "矮", pinyin: "ǎi", definition: "намхан", en: "short (height)" },
  { word: "爱好", pinyin: "àihào", definition: "хоббо, сонирхол", en: "hobby; interest" },
  { word: "安静", pinyin: "ānjìng", definition: "чимээгүй, тайван", en: "quiet; peaceful" },
  { word: "把", pinyin: "bǎ", definition: "барих; үйлийн тэмдэглэгээ", en: "handle; disposal marker" },
  { word: "班", pinyin: "bān", definition: "анги; ажлын ээлж", en: "class; shift" },
  { word: "搬", pinyin: "bān", definition: "нүүх; тээх", en: "move (house); carry" },
  { word: "半", pinyin: "bàn", definition: "хагас", en: "half" },
  { word: "帮", pinyin: "bāng", definition: "туслах", en: "help" },
  { word: "包", pinyin: "bāo", definition: "уут; боох", en: "bag; wrap" },
  { word: "饱", pinyin: "bǎo", definition: "цатгалан, хоол идсэн", en: "full (after eating)" },
  { word: "北方", pinyin: "běifāng", definition: "хойд тал, хойд нутаг", en: "north; the North" },
  { word: "被", pinyin: "bèi", definition: "идэвхгүй байдал (-д/-т); хөнжил", en: "by (passive); quilt" },
  { word: "鼻子", pinyin: "bízi", definition: "хамар", en: "nose" },
  { word: "比较", pinyin: "bǐjiào", definition: "харьцуулах; харьцангуй", en: "compare; relatively" },
  { word: "比赛", pinyin: "bǐsài", definition: "уралдаан, тэмцээн", en: "competition; match" },
  { word: "必须", pinyin: "bìxū", definition: "заавал, шаардлагатай", en: "must; have to" },
  { word: "变化", pinyin: "biànhuà", definition: "өөрчлөлт, өөрчлөгдөх", en: "change; variation" },
  { word: "表示", pinyin: "biǎoshì", definition: "илэрхийлэх, дохиолох", en: "express; indicate" },
  { word: "表演", pinyin: "biǎoyǎn", definition: "тоглох, тоглолт", en: "perform; performance" },
  { word: "别人", pinyin: "biérén", definition: "бусад хүмүүс", en: "other people; others" },
  { word: "冰箱", pinyin: "bīngxiāng", definition: "хөргөгч", en: "refrigerator" },
  { word: "不但", pinyin: "bùdàn", definition: "зөвхөн биш (…бас)", en: "not only (…but also)" },
  { word: "不过", pinyin: "búguò", definition: "гэхдээ, харин; зөвхөн", en: "but; however; only" },
  { word: "参加", pinyin: "cānjiā", definition: "оролцох", en: "participate; join" },
  { word: "草", pinyin: "cǎo", definition: "өвс", en: "grass" },
  { word: "层", pinyin: "céng", definition: "давхар; давхарга", en: "floor; layer" },
  { word: "差", pinyin: "chà", definition: "дутах; муу чанар", en: "differ; poor quality" },
  { word: "菜单", pinyin: "càidān", definition: "цэс (ресторан)", en: "menu" },
  { word: "超市", pinyin: "chāoshì", definition: "супермаркет", en: "supermarket" },
  { word: "成绩", pinyin: "chéngjì", definition: "оноо, дүн; амжилт", en: "grade; achievement" },
  { word: "城市", pinyin: "chéngshì", definition: "хот", en: "city" },
  { word: "迟到", pinyin: "chídào", definition: "хоцрох", en: "be late; arrive late" },
  { word: "出现", pinyin: "chūxiàn", definition: "гарч ирэх", en: "appear; emerge" },
  { word: "厨房", pinyin: "chúfáng", definition: "гал тогоо", en: "kitchen" },
  { word: "除了", pinyin: "chúle", definition: "-аас бусад, -аас гадна", en: "except; besides" },
  { word: "春", pinyin: "chūn", definition: "хавар", en: "spring (season)" },
  { word: "聪明", pinyin: "cōngming", definition: "ухаантай, оюунлаг", en: "clever; smart" },
  { word: "打扫", pinyin: "dǎsǎo", definition: "цэвэрлэх (шүүрдэх)", en: "clean (sweep)" },
  { word: "打算", pinyin: "dǎsuàn", definition: "төлөвлөх, санаачлах", en: "plan; intend" },
  { word: "大概", pinyin: "dàgài", definition: "ойролцоогоор, магадгүй", en: "approximately; probably" },
  { word: "大声", pinyin: "dàshēng", definition: "чанга дуугаар", en: "loudly; in a loud voice" },
  { word: "带", pinyin: "dài", definition: "авчрах; бүс", en: "bring; carry; belt" },
  { word: "担心", pinyin: "dānxīn", definition: "санаа зовох", en: "worry; be anxious" },
  { word: "蛋糕", pinyin: "dàngāo", definition: "бялуу", en: "cake" },
  { word: "当然", pinyin: "dāngrán", definition: "мэдээж, тийм ч юм уу", en: "of course; certainly" },
  { word: "地", pinyin: "de", definition: "дайвар үгийн тэмдэглэгээ", en: "adverbial particle" },
  { word: "地方", pinyin: "dìfang", definition: "газар, бүс нутаг", en: "place; region" },
  { word: "地图", pinyin: "dìtú", definition: "газрын зураг", en: "map" },
  { word: "电梯", pinyin: "diàntī", definition: "цахилгаан шат", en: "elevator; escalator" },
  { word: "电子邮件", pinyin: "diànzǐ yóujiàn", definition: "цахим шуудан", en: "email" },
  { word: "东", pinyin: "dōng", definition: "зүүн тал", en: "east" },
  { word: "动物", pinyin: "dòngwù", definition: "амьтан", en: "animal" },
  { word: "短", pinyin: "duǎn", definition: "богино", en: "short (length)" },
  { word: "段", pinyin: "duàn", definition: "хэсэг, бүлэг, хугацаа", en: "paragraph; section; period" },
  { word: "锻炼", pinyin: "duànliàn", definition: "дасгал хийх, сургуулилах", en: "exercise; train" },
  { word: "多久", pinyin: "duō jiǔ", definition: "хэр удаан", en: "how long (time)" },
  { word: "多么", pinyin: "duōme", definition: "ямар их (мэдрэмж)", en: "how (exclamation)" },
  { word: "饿", pinyin: "è", definition: "өлсгөлөн", en: "hungry" },
  { word: "而且", pinyin: "érqiě", definition: "мөн, тэгэхэд", en: "and also; moreover" },
  { word: "耳朵", pinyin: "ěrduo", definition: "чих", en: "ear" },
  { word: "方便", pinyin: "fāngbiàn", definition: "тохиромжтой, хялбар", en: "convenient" },
  { word: "放", pinyin: "fàng", definition: "тавих, байрлуулах", en: "put; place; release" },
  { word: "放心", pinyin: "fàngxīn", definition: "санаа амар бай, тайвширах", en: "don't worry; feel relieved" },
  { word: "分", pinyin: "fēn", definition: "минут; хуваах; оноо", en: "minute; divide; point" },
  { word: "复习", pinyin: "fùxí", definition: "давтах, хянах", en: "review; revise" },
  { word: "感觉", pinyin: "gǎnjué", definition: "мэдрэмж, мэдрэх", en: "feel; feeling; sense" },
  { word: "感情", pinyin: "gǎnqíng", definition: "сэтгэл хөдлөл, мэдрэмж", en: "emotion; feeling" },
  { word: "干净", pinyin: "gānjìng", definition: "цэвэр, гэгээн", en: "clean; neat" },
  { word: "刚才", pinyin: "gāngcái", definition: "яг дөнгөж, дөнгөж сая", en: "just now; a moment ago" },
  { word: "高", pinyin: "gāo", definition: "өндөр", en: "tall; high" },
  { word: "各", pinyin: "gè", definition: "тус бүр, янз бүр", en: "each; various" },
  { word: "跟", pinyin: "gēn", definition: "дагах; -тай хамт", en: "follow; with" },
  { word: "根据", pinyin: "gēnjù", definition: "-д үндэслэн", en: "according to; basis" },
  { word: "更", pinyin: "gèng", definition: "улам их, бүр ч", en: "even more; still more" },
  { word: "公里", pinyin: "gōnglǐ", definition: "километр", en: "kilometer" },
  { word: "公园", pinyin: "gōngyuán", definition: "цэцэрлэгт хүрээлэн", en: "park" },
  { word: "故事", pinyin: "gùshi", definition: "түүх, үлгэр", en: "story" },
  { word: "关系", pinyin: "guānxi", definition: "харилцаа, холбоо", en: "relationship; connection" },
  { word: "关心", pinyin: "guānxīn", definition: "санаа тавих, халамжлах", en: "care about; show concern" },
  { word: "关于", pinyin: "guānyú", definition: "-ын тухай, -д хамаатай", en: "about; regarding" },
  { word: "国家", pinyin: "guójiā", definition: "улс, орон", en: "country; nation" },
  { word: "过去", pinyin: "guòqù", definition: "өнгөрсөн; явах", en: "past; go over" },
  { word: "还是", pinyin: "háishi", definition: "...вч дээр; эсвэл", en: "had better; or" },
  { word: "寒假", pinyin: "hánjià", definition: "өвлийн амралт", en: "winter vacation" },
  { word: "好像", pinyin: "hǎoxiàng", definition: "болов уу, мэт", en: "seem; appear to be" },
  { word: "护士", pinyin: "hùshi", definition: "эмнэлгийн сувилагч", en: "nurse" },
  { word: "互联网", pinyin: "hùliánwǎng", definition: "интернет", en: "internet" },
  { word: "花园", pinyin: "huāyuán", definition: "цэцэрлэг", en: "garden; yard" },
  { word: "环境", pinyin: "huánjìng", definition: "орчин тойрон", en: "environment" },
  { word: "还", pinyin: "huán", definition: "буцааж өгөх", en: "return; pay back" },
  { word: "机会", pinyin: "jīhuì", definition: "боломж", en: "opportunity; chance" },
  { word: "季节", pinyin: "jìjié", definition: "улирал", en: "season" },
  { word: "记", pinyin: "jì", definition: "санах; тэмдэглэх", en: "remember; record" },
  { word: "急", pinyin: "jí", definition: "яаравчлах; яаралтай", en: "anxious; urgent" },
  { word: "检查", pinyin: "jiǎnchá", definition: "шалгах, үзлэг", en: "check; examine" },
  { word: "简单", pinyin: "jiǎndān", definition: "энгийн, хялбар", en: "simple; easy" },
  { word: "健康", pinyin: "jiànkāng", definition: "эрүүл мэнд; эрүүл", en: "health; healthy" },
  { word: "见面", pinyin: "jiànmiàn", definition: "уулзах", en: "meet; see each other" },
  { word: "讲", pinyin: "jiǎng", definition: "ярих, тайлбарлах", en: "speak; explain; tell" },
  { word: "角", pinyin: "jiǎo", definition: "булан; жяо (10 мөнгө)", en: "corner; jiao (10 cents)" },
  { word: "结婚", pinyin: "jiéhūn", definition: "гэрлэх", en: "marry; get married" },
  { word: "解决", pinyin: "jiějué", definition: "шийдвэрлэх", en: "solve; resolve" },
  { word: "借", pinyin: "jiè", definition: "зээлэх, зээлдэх", en: "borrow; lend" },
  { word: "经过", pinyin: "jīngguò", definition: "дамжин өнгөрөх; явц", en: "pass; go through; process" },
  { word: "经验", pinyin: "jīngyàn", definition: "туршлага", en: "experience" },
  { word: "久", pinyin: "jiǔ", definition: "удаан хугацаанд", en: "for a long time" },
  { word: "就是", pinyin: "jiùshì", definition: "яг тэр; тийм ч юм уу", en: "it is precisely; that is" },
  { word: "举行", pinyin: "jǔxíng", definition: "зохион байгуулах", en: "hold (an event)" },
  { word: "句子", pinyin: "jùzi", definition: "өгүүлбэр", en: "sentence" },
  { word: "决定", pinyin: "juédìng", definition: "шийдэх, шийдвэр", en: "decide; decision" },
  { word: "可爱", pinyin: "kě'ài", definition: "хөөрхөн, энхэрэл", en: "cute; adorable" },
  { word: "可是", pinyin: "kěshì", definition: "гэхдээ, харин", en: "but; however" },
  { word: "刻", pinyin: "kè", definition: "15 минут; сийлэх", en: "quarter hour; carve" },
  { word: "客人", pinyin: "kèrén", definition: "зочин", en: "guest; visitor" },
  { word: "筷子", pinyin: "kuàizi", definition: "таяг (хятад хоол идэх)", en: "chopsticks" },
  { word: "来不及", pinyin: "lái bùjí", definition: "хожимдсон, амжиж чадахгүй", en: "not have time; too late" },
  { word: "冷静", pinyin: "lěngjìng", definition: "тайван, санаа зовохгүй", en: "calm; cool-headed" },
  { word: "历史", pinyin: "lìshǐ", definition: "түүх", en: "history" },
  { word: "脸", pinyin: "liǎn", definition: "царай, нүүр", en: "face" },
  { word: "练习", pinyin: "liànxí", definition: "дасгал хийх, дадлага", en: "practice; exercise" },
  { word: "联系", pinyin: "liánxi", definition: "холбоо барих", en: "contact; connection" },
  { word: "了解", pinyin: "liǎojiě", definition: "ойлгох, мэдэх (гүнзгий)", en: "understand; know (in depth)" },
  { word: "楼", pinyin: "lóu", definition: "давхар; барилга", en: "floor; building" },
  { word: "麻烦", pinyin: "máfan", definition: "зовлон, төвөгтэй", en: "trouble; troublesome" },
  { word: "满意", pinyin: "mǎnyì", definition: "сэтгэл ханасан", en: "satisfied; pleased" },
  { word: "帽子", pinyin: "màozi", definition: "малгай", en: "hat; cap" },
  { word: "马上", pinyin: "mǎshàng", definition: "шууд, дор нь", en: "right away; immediately" },
  { word: "每", pinyin: "měi", definition: "бүр, тус бүр", en: "every; each" },
  { word: "迷", pinyin: "mí", definition: "шүтэн биширдэг; фан", en: "be crazy about; fan" },
  { word: "米", pinyin: "mǐ", definition: "метр; будаа", en: "meter; rice" },
  { word: "秘书", pinyin: "mìshū", definition: "нарийн бичгийн дарга", en: "secretary" },
  { word: "面", pinyin: "miàn", definition: "нүүр; гадаргуу; гоймон", en: "face; surface; noodles" },
  { word: "明显", pinyin: "míngxiǎn", definition: "тодорхой, илт", en: "obvious; clear" },
  { word: "奶奶", pinyin: "nǎinai", definition: "эмээ (аавын тал)", en: "paternal grandmother" },
  { word: "难", pinyin: "nán", definition: "хэцүү", en: "difficult; hard" },
  { word: "难道", pinyin: "nándào", definition: "юу гэнэ дээ? (гайхшрал)", en: "could it be that?" },
  { word: "南方", pinyin: "nánfāng", definition: "өмнөд тал, өмнөд нутаг", en: "south; the South" },
  { word: "年级", pinyin: "niánjí", definition: "ангийн дугаар (сургуульд)", en: "grade; year (school)" },
  { word: "年轻", pinyin: "niánqīng", definition: "залуу", en: "young" },
  { word: "努力", pinyin: "nǔlì", definition: "хичээх, чармайх", en: "work hard; effort" },
  { word: "暖和", pinyin: "nuǎnhuo", definition: "дулаахан, дулаан", en: "warm; pleasantly warm" },
  { word: "爬山", pinyin: "pá shān", definition: "уул авирах", en: "climb a mountain" },
  { word: "怕", pinyin: "pà", definition: "айх", en: "fear; be afraid" },
  { word: "盘子", pinyin: "pánzi", definition: "тавиур, таваг", en: "plate; dish" },
  { word: "胖", pinyin: "pàng", definition: "тарган", en: "fat; plump" },
  { word: "皮肤", pinyin: "pífū", definition: "арьс", en: "skin" },
  { word: "普通话", pinyin: "pǔtōnghuà", definition: "Путунхуа (стандарт хятад хэл)", en: "Mandarin Chinese" },
  { word: "其他", pinyin: "qítā", definition: "бусад, өөр", en: "other; others" },
  { word: "奇怪", pinyin: "qíguài", definition: "хачин, гайхалтай", en: "strange; odd" },
  { word: "气候", pinyin: "qìhòu", definition: "цаг уур (бүс нутгийн)", en: "climate" },
  { word: "其实", pinyin: "qíshí", definition: "үнэндээ, яг бол", en: "actually; in fact" },
  { word: "千", pinyin: "qiān", definition: "мянга", en: "thousand" },
  { word: "签证", pinyin: "qiānzhèng", definition: "виз", en: "visa" },
  { word: "墙", pinyin: "qiáng", definition: "хана", en: "wall" },
  { word: "桥", pinyin: "qiáo", definition: "гүүр", en: "bridge" },
  { word: "亲戚", pinyin: "qīnqi", definition: "төрөл садан", en: "relatives; family" },
  { word: "请假", pinyin: "qǐngjià", definition: "чөлөө авах", en: "ask for leave" },
  { word: "裙子", pinyin: "qúnzi", definition: "цамц юбка", en: "skirt" },
  { word: "然后", pinyin: "ránhòu", definition: "тэгэсний дараа", en: "then; after that" },
  { word: "热情", pinyin: "rèqíng", definition: "идэвхтэй, халуун дотно", en: "enthusiastic; warm" },
  { word: "认真", pinyin: "rènzhēn", definition: "ноцтой, хичээнгүй", en: "serious; earnest" },
  { word: "容易", pinyin: "róngyì", definition: "хялбар, амархан", en: "easy; simple" },
  { word: "入口", pinyin: "rùkǒu", definition: "орох хаалга, вход", en: "entrance" },
  { word: "伤心", pinyin: "shāngxīn", definition: "гунигтай, зүрх өвдөх", en: "sad; heartbroken" },
  { word: "上班", pinyin: "shàngbān", definition: "ажилдаа явах", en: "go to work" },
  { word: "声音", pinyin: "shēngyīn", definition: "дуу хоолой", en: "sound; voice" },
  { word: "生气", pinyin: "shēngqì", definition: "уурлах, ядрах", en: "angry; get angry" },
  { word: "世界", pinyin: "shìjiè", definition: "дэлхий", en: "world" },
  { word: "数学", pinyin: "shùxué", definition: "математик", en: "mathematics" },
  { word: "数字", pinyin: "shùzì", definition: "тоо, цифр", en: "number; numeral" },
  { word: "树", pinyin: "shù", definition: "мод", en: "tree" },
  { word: "帅", pinyin: "shuài", definition: "сайхан (эр хүн)", en: "handsome" },
  { word: "水平", pinyin: "shuǐpíng", definition: "түвшин, стандарт", en: "level; standard" },
  { word: "说话", pinyin: "shuōhuà", definition: "ярих, хэлэх", en: "speak; talk" },
  { word: "死", pinyin: "sǐ", definition: "үхэх, нас барах", en: "die; death" },
  { word: "速度", pinyin: "sùdù", definition: "хурд", en: "speed" },
  { word: "所有", pinyin: "suǒyǒu", definition: "бүх, бүгд", en: "all; every" },
  { word: "太阳", pinyin: "tàiyáng", definition: "нар", en: "sun" },
  { word: "特别", pinyin: "tèbié", definition: "тусгай, ялангуяа", en: "special; especially" },
  { word: "体育", pinyin: "tǐyù", definition: "биеийн тамир", en: "sports; physical education" },
  { word: "提高", pinyin: "tígāo", definition: "сайжруулах, дээшлүүлэх", en: "improve; raise; increase" },
  { word: "甜", pinyin: "tián", definition: "чихэрлэг", en: "sweet" },
  { word: "条", pinyin: "tiáo", definition: "тоо хэмжүүр (урт/уян зүйл)", en: "measure word (long flexible objects)" },
  { word: "通知", pinyin: "tōngzhī", definition: "мэдэгдэх, мэдэгдэл", en: "notify; notice" },
  { word: "推", pinyin: "tuī", definition: "түлхэх", en: "push" },
  { word: "腿", pinyin: "tuǐ", definition: "хөл (биеийн хэсэг)", en: "leg" },
  { word: "完成", pinyin: "wánchéng", definition: "дуусгах, биелүүлэх", en: "complete; finish" },
  { word: "忘", pinyin: "wàng", definition: "мартах", en: "forget" },
  { word: "网球", pinyin: "wǎngqiú", definition: "теннис", en: "tennis" },
  { word: "卫生间", pinyin: "wèishēngjiān", definition: "угаалгын өрөө, жорлон", en: "bathroom; restroom" },
  { word: "为了", pinyin: "wèile", definition: "-ийн тулд", en: "in order to; for the sake of" },
  { word: "位", pinyin: "wèi", definition: "хүндэтгэлтэй тоолуур (хүнд)", en: "(polite measure for people)" },
  { word: "文化", pinyin: "wénhuà", definition: "соёл", en: "culture" },
  { word: "习惯", pinyin: "xíguàn", definition: "зан заншил; дасах", en: "habit; be used to" },
  { word: "洗手间", pinyin: "xǐshǒujiān", definition: "гар угаах өрөө", en: "restroom; lavatory" },
  { word: "先", pinyin: "xiān", definition: "эхлээд, урьдаар", en: "first; in advance" },
  { word: "向", pinyin: "xiàng", definition: "-руу; харах", en: "toward; to; face" },
  { word: "像", pinyin: "xiàng", definition: "адилхан, төстэй", en: "be like; resemble" },
  { word: "小吃", pinyin: "xiǎochī", definition: "хөнгөн хоол, зууш", en: "snack; light meal" },
  { word: "笑话", pinyin: "xiàohuà", definition: "хошигнол, ёжин", en: "joke" },
  { word: "心情", pinyin: "xīnqíng", definition: "сэтгэлийн байдал", en: "mood; state of mind" },
  { word: "信息", pinyin: "xìnxi", definition: "мэдээлэл, мессеж", en: "information; message" },
  { word: "行李箱", pinyin: "xíngli xiāng", definition: "чемодан", en: "suitcase; luggage" },
  { word: "要求", pinyin: "yāoqiú", definition: "шаардах, шаардлага", en: "require; demand" },
  { word: "也许", pinyin: "yěxǔ", definition: "магадгүй, болов уу", en: "perhaps; maybe" },
  { word: "一般", pinyin: "yībān", definition: "энгийн; ихэвчлэн", en: "ordinary; usually" },
  { word: "一定", pinyin: "yīdìng", definition: "заавал, мэдээж", en: "definitely; certainly" },
  { word: "一共", pinyin: "yīgòng", definition: "нийт, бүгд дээр", en: "altogether; in total" },
  { word: "一会儿", pinyin: "yīhuìr", definition: "нэг хором, бага зэрэг", en: "a moment; a while" },
  { word: "一样", pinyin: "yīyàng", definition: "адилхан, ижил", en: "the same; alike" },
  { word: "已经", pinyin: "yǐjīng", definition: "аль хэдийнэ", en: "already" },
  { word: "以前", pinyin: "yǐqián", definition: "өмнө нь, урьд нь", en: "before; in the past" },
  { word: "一直", pinyin: "yīzhí", definition: "байнга; шулуу; тасралтгүй", en: "always; straight; continuously" },
  { word: "以后", pinyin: "yǐhòu", definition: "цаашид, дараа нь", en: "later; in the future" },
  { word: "因此", pinyin: "yīncǐ", definition: "тийм болохоор, тиймээс", en: "therefore; thus" },
  { word: "银行", pinyin: "yínháng", definition: "банк", en: "bank" },
  { word: "应该", pinyin: "yīnggāi", definition: "ёстой, хэрэгтэй", en: "should; ought to" },
  { word: "由于", pinyin: "yóuyú", definition: "учир нь, -аас болж", en: "due to; because of" },
  { word: "原来", pinyin: "yuánlái", definition: "анхандаа; гэж харах юм бол", en: "originally; it turns out" },
  { word: "允许", pinyin: "yǔnxǔ", definition: "зөвшөөрөх", en: "allow; permit" },
  { word: "增加", pinyin: "zēngjiā", definition: "нэмэх, өсгөх", en: "increase; add" },
  { word: "站", pinyin: "zhàn", definition: "зогсох; буудал", en: "stand; stop; station" },
  { word: "长大", pinyin: "zhǎngdà", definition: "өсөх, том болох", en: "grow up" },
  { word: "着急", pinyin: "zháojí", definition: "санаа зовох, яарах", en: "worried; anxious" },
  { word: "真", pinyin: "zhēn", definition: "үнэхээр, үнэн", en: "really; true" },
  { word: "整理", pinyin: "zhěnglǐ", definition: "эмхэлэх, цэгцлэх", en: "sort out; tidy up" },
  { word: "正在", pinyin: "zhèngzài", definition: "одоо хийж байгаа", en: "in the process of; currently" },
  { word: "只", pinyin: "zhǐ", definition: "зөвхөн, л", en: "only; just" },
  { word: "只有", pinyin: "zhǐyǒu", definition: "зөвхөн...л", en: "only if; only when" },
  { word: "终于", pinyin: "zhōngyú", definition: "эцэст нь, ингээд", en: "finally; at last" },
  { word: "中文", pinyin: "zhōngwén", definition: "хятад хэл (бичгийн)", en: "Chinese (written language)" },
  { word: "重", pinyin: "zhòng", definition: "хүнд; жин", en: "heavy; weight" },
  { word: "种", pinyin: "zhǒng", definition: "төрөл; тарих", en: "type; kind; plant" },
  { word: "周末", pinyin: "zhōumò", definition: "амралтын өдрүүд", en: "weekend" },
  { word: "祝", pinyin: "zhù", definition: "ерөөх, амжилт хүсэх", en: "wish; congratulate" },
  { word: "注意", pinyin: "zhùyì", definition: "анхаарал хандуулах", en: "pay attention; be careful" },
  { word: "专业", pinyin: "zhuānyè", definition: "мэргэжил, чиглэл", en: "major; specialty" },
  { word: "自己", pinyin: "zìjǐ", definition: "өөрөө, өөрийн", en: "self; oneself" },
  { word: "总是", pinyin: "zǒngshì", definition: "үргэлж, байнга", en: "always; all the time" },
  { word: "最后", pinyin: "zuìhòu", definition: "сүүлийн, эцэст нь", en: "last; finally" },
  { word: "作业", pinyin: "zuòyè", definition: "гэрийн даалгавар", en: "homework; assignment" },
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
      en:            v.en || '',
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
