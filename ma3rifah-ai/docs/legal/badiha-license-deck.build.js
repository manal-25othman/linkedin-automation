const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.rtlMode = true;
pres.lang = 'ar-SA';

const NAVY='1E3967', GOLD='C9A24C', INK='1B2330', MUTED='5B6573', SOFT='E9EEF6', WHITE='FFFFFF', LINE='D9DEE7', GREEN='1E7F4F';
const F='Arial';
const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox:true, fontFace:F, rtlMode:true, lang:'ar-SA', margin:0, color:INK, valign:'top' }, o));
const spark = (slide, x, y, s, fg) => {
  // four-point spark as a simple diamond-ish shape (brand mark stand-in)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w:s, h:s, rectRadius:s*0.25, fill:{color:NAVY} });
  slide.addShape(pres.shapes.DIAMOND, { x:x+s*0.18, y:y+s*0.12, w:s*0.52, h:s*0.52, fill:{color:fg||GOLD}, line:{color:fg||GOLD} });
  slide.addShape(pres.shapes.DIAMOND, { x:x+s*0.6, y:y+s*0.58, w:s*0.26, h:s*0.26, fill:{color:WHITE, transparency:25}, line:{color:WHITE, transparency:25} });
};
const header = (slide, title, en) => {
  slide.background = { color: WHITE };
  T(slide, title, { x:1.3, y:0.35, w:8.1, h:0.6, fontSize:28, bold:true, color:NAVY, align:'right' });
  if (en) T(slide, en, { x:0.6, y:0.95, w:8.8, h:0.3, fontSize:11, color:MUTED, align:'right', rtlMode:false, lang:'en-US' });
  spark(slide, 0.6, 0.38, 0.45);
  T(slide, 'بديهة · ملف المشروع', { x:0.6, y:5.2, w:3, h:0.25, fontSize:9, color:MUTED, align:'left' });
};
const card = (slide, x, y, w, h, title, body, opts={}) => {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius:0.12, fill:{color:opts.fill||SOFT}, line:{color:opts.fill||SOFT} });
  T(slide, title, { x:x+0.2, y:y+0.15, w:w-0.4, h:0.35, fontSize:opts.tSize||14, bold:true, color:opts.tColor||NAVY, align:'right' });
  if (body) T(slide, body, { x:x+0.2, y:y+0.55, w:w-0.4, h:h-0.7, fontSize:opts.bSize||11, color:opts.bColor||INK, align:'right', lineSpacingMultiple:1.15 });
};

// 1 ── الغلاف
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  spark(s, 4.3, 0.9, 1.4, GOLD);
  T(s, 'بديهة', { x:1, y:2.45, w:8, h:0.8, fontSize:44, bold:true, color:WHITE, align:'center' });
  T(s, 'Badiha', { x:1, y:3.2, w:8, h:0.4, fontSize:18, color:GOLD, align:'center', rtlMode:false, lang:'en-US' });
  T(s, 'منصة معرفة مؤسسية تجيب موظفي الشركة من مستنداتها هي، بالعربية، مع ذكر المصدر', { x:1, y:3.7, w:8, h:0.4, fontSize:14, color:WHITE, align:'center' });
  T(s, 'Arabic-first enterprise knowledge platform · answers grounded in the company\'s own documents', { x:1, y:4.1, w:8, h:0.3, fontSize:11, color:'B8C2D6', align:'center', rtlMode:false, lang:'en-US' });
  T(s, 'ملف المشروع لطلب رخصة ريادة الأعمال · المؤسِّسة: منال العارقي', { x:1, y:4.85, w:8, h:0.3, fontSize:11, color:'B8C2D6', align:'center' });
}

// 2 ── المقدمة
{
  const s = pres.addSlide(); header(s, 'المقدمة: السياق والتحدي', 'Introduction');
  card(s, 5.1, 1.45, 4.3, 3.5, 'السياق الوطني',
    'تضع رؤية ٢٠٣٠ التحول الرقمي والاقتصاد القائم على البيانات في صلب أهدافها، وتقود الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) استراتيجية وطنية لتوطين حلول الذكاء الاصطناعي.\n\nفي المقابل ما زالت معظم معرفة الشركات السعودية محبوسة في ملفات PDF وWord وأرشيفات ممسوحة ضوئيًا، بالعربية، لا تفهمها الأدوات العالمية كما ينبغي.', { fill:SOFT });
  card(s, 0.6, 1.45, 4.3, 3.5, 'التحدي الذي تحلّه بديهة',
    '• الموظف يسأل زميله بدل أن يجد الجواب في اللائحة، فتُعاد الأسئلة نفسها كل يوم.\n\n• الأدوات العامة تخطئ في قراءة ملفات PDF العربية وتخترع تفاصيل لا وجود لها في السياسة.\n\n• لا أحد يعرف أي الأسئلة بلا جواب موثّق، فتبقى فجوات التوثيق مخفية.\n\n• الأرشيف الممسوح ضوئيًا، وهو جزء كبير من مستندات الشركات، خارج أي بحث.', { fill:WHITE });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6, y:1.45, w:4.3, h:3.5, rectRadius:0.12, fill:{color:WHITE, transparency:100}, line:{color:LINE, width:1} });
}

// 3 ── من تربط المنصة
{
  const s = pres.addSlide(); header(s, 'من تربط المنصة', 'Who the platform connects');
  const cx=5, cy=3.15;
  const nodes = [
    ['إدارة الشركة', 'ترفع اللوائح والإجراءات، وتحدّد من يرى ماذا، وتقرأ التحليلات', cx-4.3, cy-1.85],
    ['الموظفون', 'يسألون بلغتهم عبر الويب أو واتساب ويحصلون على جواب بمصدره', cx+1.6, cy-1.85],
    ['مستندات الشركة', 'PDF وWord ونصوص ومسوحات ضوئية وصور، تُفهرس وتُقرأ صفحة صفحة', cx-4.3, cy+0.65],
    ['نموذج الذكاء الاصطناعي', 'يُقيَّد بمستندات الشركة وحدها، ويمرّ كل جواب بمدقّق مستقل', cx+1.6, cy+0.65],
  ];
  for (const [t,b,x,y] of nodes) {
    const ex = x < cx ? x+2.7 : x, ey = y+0.6;
    s.addShape(pres.shapes.LINE, { x:Math.min(ex,cx), y:Math.min(ey,cy), w:Math.abs(cx-ex), h:Math.abs(cy-ey), line:{color:GOLD, width:1.5, dashType:'dash'}, flipV: (ex<cx) !== (ey<cy) });
  }
  s.addShape(pres.shapes.OVAL, { x:cx-0.8, y:cy-0.8, w:1.6, h:1.6, fill:{color:NAVY}, line:{color:NAVY} });
  T(s, 'بديهة', { x:cx-0.8, y:cy-0.25, w:1.6, h:0.5, fontSize:18, bold:true, color:WHITE, align:'center' });
  for (const [t,b,x,y] of nodes) card(s, x, y, 2.7, 1.2, t, b, { fill:SOFT, tSize:13, bSize:10 });
}

// 4 ── التقنيات المتقدمة
{
  const s = pres.addSlide(); header(s, 'التقنيات المستخدمة', 'Technology');
  const items = [
    ['استرجاع هجين للعربية', 'بحث دلالي بالمتجهات مع بحث نصي مضبوط على الصرف العربي، فتُلتقط الصياغات المختلفة للسؤال نفسه.'],
    ['قراءة ضوئية بالرؤية', 'المستندات الممسوحة والصور تُنسخ صفحة صفحة عبر نموذج رؤية، ثم تُفهرس كأي مستند.'],
    ['مدقّق حتمي للأرقام', 'كل رقم ومدة ومبلغ في الجواب يُقارَن بنص المصدر قبل العرض، بلا نموذج، فلا يمكنه التخمين.'],
    ['عزل مثبَت بالاختبار', 'عزل الشركات على مستوى قاعدة البيانات (RLS) ويغطّيه ٢٣٢ اختبارًا آليًا واختبار طفرات.'],
    ['تحليلات وفجوات المعرفة', 'الأسئلة التي لم تجد جوابًا تتحول إلى تقرير توثيق، وتُقاس جودة الإجابات والاستخدام.'],
    ['قناة واتساب', 'الموظف يسأل من هاتفه بنفس الصلاحيات، بربط الرقم برمز من حسابه.'],
  ];
  items.forEach(([t,b],i) => {
    const col = i%3, row = Math.floor(i/3);
    const x = 0.6 + (2-col)*3.0, y = 1.45 + row*1.85;
    s.addShape(pres.shapes.OVAL, { x:x+2.35, y:y+0.12, w:0.4, h:0.4, fill:{color:GOLD}, line:{color:GOLD} });
    card(s, x, y, 2.8, 1.65, t, b, { fill:SOFT, tSize:13, bSize:10 });
  });
}

// 5 ── نبذة عن المشروع
{
  const s = pres.addSlide(); header(s, 'نبذة عن المشروع', 'About the project');
  T(s, 'بديهة منصة سعودية تعمل في الإنتاج اليوم. ترفع الشركة لوائحها وسياساتها وأدلة إجراءاتها، فيسأل موظفوها بالعربية ويحصلون على إجابات مبنية على تلك المستندات وحدها، مع اسم المستند ورقم الصفحة تحت كل إجابة.\n\nحين لا يجد النظام جوابًا يقول ذلك صراحةً بدل أن يخترع، ويسجّل السؤال ضمن تقرير فجوات المعرفة الذي يوجّه الإدارة إلى ما ينقص توثيقه.\n\nالمنصة متعددة المستأجرين: كل شركة معزولة عن الأخرى في قاعدة البيانات نفسها، والصلاحيات على مستوى المستند (الشركة، القسم، الدور).\n\nالنشاط: تطوير وتشغيل منصة سحابية (SaaS) تُباع باشتراك شهري أو سنوي لمنشآت القطاع الخاص في المملكة.',
    { x:4.4, y:1.45, w:5.0, h:3.6, fontSize:12, align:'right', lineSpacingMultiple:1.2 });
  // mock chat card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6, y:1.45, w:3.5, h:3.5, rectRadius:0.15, fill:{color:WHITE}, line:{color:LINE, width:1}, shadow:{type:'outer', blur:6, offset:2, angle:90, color:'000000', opacity:0.12} });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:1.0, y:1.75, w:2.7, h:0.5, rectRadius:0.1, fill:{color:SOFT}, line:{color:SOFT} });
  T(s, 'كم مدة الإجازة السنوية؟', { x:1.1, y:1.85, w:2.5, h:0.3, fontSize:10, align:'right' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.8, y:2.45, w:3.1, h:1.5, rectRadius:0.1, fill:{color:WHITE}, line:{color:LINE, width:1} });
  T(s, '٣٠ يومًا بعد إتمام خمس سنوات من الخدمة، و٢١ يومًا قبل ذلك.', { x:0.95, y:2.55, w:2.8, h:0.7, fontSize:10, align:'right', lineSpacingMultiple:1.15 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:1.9, y:3.4, w:1.85, h:0.32, rectRadius:0.16, fill:{color:SOFT}, line:{color:SOFT} });
  T(s, 'لائحة الموارد البشرية · ص ١٢', { x:1.95, y:3.45, w:1.75, h:0.25, fontSize:8, color:NAVY, align:'center' });
  T(s, 'ثقة عالية ✓', { x:0.95, y:3.45, w:0.9, h:0.25, fontSize:8, bold:true, color:GREEN, align:'left' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.8, y:4.2, w:3.1, h:0.45, rectRadius:0.1, fill:{color:WHITE}, line:{color:LINE, width:1} });
  T(s, 'اسأل عن سياسة أو إجراء…', { x:0.95, y:4.3, w:2.8, h:0.25, fontSize:9, color:MUTED, align:'right' });
}

// 6 ── القيمة المضافة + الحلول الأساسية
{
  const s = pres.addSlide(); header(s, 'القيمة المضافة والحلول الأساسية', 'Value & core solutions');
  card(s, 5.1, 1.45, 4.3, 3.6, 'القيمة المضافة',
    '• جواب موثّق في ثوانٍ بدل سؤال زميل أو البحث في عشرات الملفات.\n\n• توقّف تكرار الأسئلة نفسها على الموارد البشرية والعمليات.\n\n• إجابات لا تخترع: المصدر تحت كل جواب، والأرقام مدقَّقة.\n\n• رؤية للإدارة: ما يُسأل، وما لا جواب له، وأي مستند يُستشهد به.\n\n• الأرشيف الممسوح ضوئيًا يصير قابلًا للسؤال.', { fill:SOFT, bSize:11.5 });
  card(s, 0.6, 1.45, 4.3, 3.6, 'الحلول الأساسية',
    '• المساعد الذكي: سؤال وجواب من مستندات الشركة مع المصادر وشارة الثقة.\n\n• قاعدة المعرفة: تصنيفات وصلاحيات على مستوى المستند.\n\n• فجوات المعرفة: الأسئلة بلا جواب تتحول إلى خطة توثيق مع مسودة مقترحة.\n\n• التحليلات: الاستخدام وجودة الإجابات والتكلفة لكل شركة وقسم.\n\n• قنوات: الويب وواتساب، بنفس الصلاحيات.', { fill:WHITE, bSize:11.5 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6, y:1.45, w:4.3, h:3.6, rectRadius:0.12, fill:{color:WHITE, transparency:100}, line:{color:LINE, width:1} });
}

// 7 ── الابتكار والتقنية
{
  const s = pres.addSlide(); header(s, 'الابتكار والتقنية', 'Innovation');
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6, y:1.45, w:8.8, h:1.15, rectRadius:0.12, fill:{color:NAVY}, line:{color:NAVY} });
  T(s, 'الابتكار الجوهري', { x:0.8, y:1.55, w:8.4, h:0.3, fontSize:13, bold:true, color:GOLD, align:'right' });
  T(s, 'العربية قيد تصميم لا طبقة ترجمة: خط معالجة كامل مبني للمستندات العربية، من إصلاح تشوّه حروف PDF إلى الاسترجاع الصرفي، يليه مدقّق حتمي لا يستطيع الهلوسة لأنه لا يستنتج، بل يقارن كل رقم بنص مصدره.', { x:0.8, y:1.88, w:8.4, h:0.65, fontSize:11.5, color:WHITE, align:'right', lineSpacingMultiple:1.15 });
  const pillars = [
    ['إصلاح PDF العربي', 'كشف تشوّه الحروف الشائع في ملفات PDF العربية وإصلاحه قبل الفهرسة.'],
    ['استرجاع صرفي', 'تطبيع وتجذير عربي داخل قاعدة البيانات، مدمج مع البحث الدلالي.'],
    ['تدقيق قبل العرض', 'المُدد والمبالغ تُفحص ضد المصدر، وما لا أصل له يظهر عليه تحذير.'],
    ['عزل مُثبَت', 'حرّاس العزل تُعطَّل عمدًا في بناء اختباري ويجب أن تفشل الاختبارات، وهي تفشل.'],
  ];
  pillars.forEach(([t,b],i) => {
    const x = 0.6 + (3-i)*2.25;
    card(s, x, 2.85, 2.1, 2.2, t, b, { fill:SOFT, tSize:12.5, bSize:10 });
  });
}

// 8 ── نموذج الإيرادات + مصادر إضافية + السوق + الخطة التشغيلية
{
  const s = pres.addSlide(); header(s, 'نموذج العمل والسوق والخطة التشغيلية', 'Business model · market · operating plan');
  const q = [
    ['نموذج الإيرادات', 'اشتراك شهري أو سنوي حسب الحجم:\n• الأساسية ٨٩٩ ريال/شهر\n• النمو ٢٬٤٩٩ ريال/شهر\n• الأعمال ٥٬٩٩٩ ريال/شهر\nتجربة مجانية ٧ أيام. الحدود بعدد المستخدمين والمستندات والأسئلة.'],
    ['مصادر إضافية', '• تهيئة وترحيل الأرشيف (رسوم لمرة واحدة)\n• حزم قراءة ضوئية للأرشيفات الكبيرة\n• قناة شركاء: مكاتب استشارات الموارد البشرية والمحاماة كموزّعين\n• متطلبات عملاء الحجم الأكبر (SSO، تكاملات)'],
    ['السوق المستهدف', 'المنشآت الصغيرة والمتوسطة في المملكة (٢٠ إلى ٥٠٠ موظف) ذات اللوائح والإجراءات الكثيفة: التجزئة والخدمات اللوجستية والرعاية الصحية والخدمات المهنية. الدخول عبر إدارات الموارد البشرية والعمليات.'],
    ['الخطة التشغيلية', '• السنة ١: الإثبات، ٣ تجارب ثم ٥ عملاء يدفعون\n• السنة ٢: التكرار، مسؤول بيع وقناة شركاء\n• السنة ٣: التعميق، تكاملات وشهادة أمنية\n• السنتان ٤ و٥: التوسع الجغرافي (الشريحة ١٠)'],
  ];
  q.forEach(([t,b],i) => {
    const col=i%2, row=Math.floor(i/2);
    card(s, 0.6 + (1-col)*4.5, 1.45 + row*1.85, 4.3, 1.7, t, b, { fill: row===0?SOFT:WHITE, tSize:13, bSize:10 });
    if (row===1) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.6 + (1-col)*4.5, y:1.45 + row*1.85, w:4.3, h:1.7, rectRadius:0.12, fill:{color:WHITE, transparency:100}, line:{color:LINE, width:1} });
  });
}

// 9 ── الخطة المالية + التوظيف (٥ سنوات)
{
  const s = pres.addSlide(); header(s, 'المالية والتوظيف لخمس سنوات', 'Five-year financial & hiring plan');
  T(s, 'الإيراد السنوي المتوقع (مليون ريال). الحد الأدنى السيناريو المتحفّظ والأعلى الأساسي؛ السنتان ٤ و٥ امتداد بنفس الوتيرة.', { x:3.2, y:1.4, w:6.2, h:0.4, fontSize:10, color:MUTED, align:'right' });
  const years = ['السنة ١','السنة ٢','السنة ٣','السنة ٤','السنة ٥'];
  s.addChart(pres.charts.BAR, [
    { name:'الحد الأدنى', labels:years, values:[0.08,0.35,0.80,1.30,1.90] },
    { name:'الحد الأعلى', labels:years, values:[0.23,0.80,1.69,2.50,3.50] },
  ], { x:3.2, y:1.8, w:6.2, h:3.2, barDir:'col', barGrouping:'clustered', chartColors:[GOLD, NAVY],
       showValue:true, dataLabelPosition:'outEnd', dataLabelFontSize:8, dataLabelColor:INK, dataLabelFormatCode:'0.00',
       catAxisLabelColor:INK, catAxisLabelFontSize:9, valAxisLabelColor:MUTED, valAxisLabelFontSize:8, valAxisMaxVal:4,
       valGridLine:{color:LINE, size:0.5}, catGridLine:{style:'none'}, showLegend:true, legendPos:'b', legendFontSize:9, legendColor:INK });
  card(s, 0.6, 1.4, 2.4, 3.6, 'الفريق نهاية كل سنة', '', { fill:SOFT });
  const hires = [['١','المؤسِّسة'],['٢','+ مسؤول بيع'],['٣–٤','+ نجاح عملاء، مهندس'],['٥','+ مبيعات ثانٍ'],['٦–٧','+ مهندس، دعم']];
  hires.forEach(([n,r],i) => {
    const y = 1.95 + i*0.58;
    T(s, n, { x:2.25, y, w:0.6, h:0.45, fontSize:20, bold:true, color:NAVY, align:'center', valign:'middle' });
    T(s, `السنة ${['١','٢','٣','٤','٥'][i]}`, { x:0.75, y:y+0.02, w:1.45, h:0.2, fontSize:8, color:MUTED, align:'right' });
    T(s, r, { x:0.75, y:y+0.2, w:1.45, h:0.25, fontSize:9.5, color:INK, align:'right' });
  });
}

// 10 ── خطة التوسع
{
  const s = pres.addSlide(); header(s, 'خطة التوسع', 'Expansion plan');
  const stages = [
    ['السنوات ١ إلى ٣', 'داخل المملكة', 'الرياض ثم جدة والدمام. بيع مباشر وقناة شركاء، وبناء المراجع والشهادة الأمنية. المنشأة والفريق والاستضافة في المملكة.'],
    ['السنتان ٤ و٥', 'دول الخليج', 'الإمارات وقطر والكويت عبر شركاء محليين، بالمنتج نفسه واللغة نفسها، مع خيار استضافة إقليمية.'],
    ['بعد السنة ٥', 'الأسواق الناطقة بالعربية', 'مصر والأردن والمغرب العربي حيث لا يوجد بديل عربي أولًا، وبمعايير أمان مبنية للمؤسسات.'],
  ];
  s.addShape(pres.shapes.LINE, { x:1.2, y:2.35, w:7.6, h:0, line:{color:GOLD, width:2} });
  stages.forEach(([when,where,body],i) => {
    const x = 0.6 + (2-i)*3.0;
    s.addShape(pres.shapes.OVAL, { x:x+1.2, y:2.15, w:0.4, h:0.4, fill:{color: i===0?GOLD:WHITE}, line:{color:GOLD, width:2} });
    T(s, when, { x, y:1.6, w:2.8, h:0.3, fontSize:10, color:MUTED, align:'center' });
    T(s, where, { x, y:2.75, w:2.8, h:0.4, fontSize:16, bold:true, color:NAVY, align:'center' });
    T(s, body, { x:x+0.1, y:3.2, w:2.6, h:1.6, fontSize:10.5, color:INK, align:'right', lineSpacingMultiple:1.15 });
  });
  T(s, 'الاستثمار في الاقتصاد السعودي أولًا: التأسيس والتوظيف والاستضافة والعملاء الأوائل كلهم داخل المملكة قبل أي توسع.', { x:0.6, y:4.8, w:8.8, h:0.3, fontSize:10, color:MUTED, align:'right' });
}

pres.writeFile({ fileName: process.argv[2] }).then(f => console.log('wrote', f));
