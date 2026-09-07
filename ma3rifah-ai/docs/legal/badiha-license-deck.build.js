const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.rtlMode = true;
pres.lang = 'ar-SA';

const NAVY='1E3967', GOLD='C9A24C', CYAN='1B7FA8', INK='1B2330', MUTED='5B6573',
      SOFT='E9EEF6', WHITE='FFFFFF', LINE='D9DEE7', GREEN='1E7F4F', SAND='F7F4EC';
const F='Arial';

const T=(s,text,o)=>s.addText(text,Object.assign({isTextBox:true,fontFace:F,rtlMode:true,lang:'ar-SA',margin:0,color:INK,valign:'top'},o));
const box=(s,x,y,w,h,fill,line)=>s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w,h,rectRadius:0.1,fill:{color:fill},line:line?{color:line,width:1}:{color:fill}});

const spark=(s,x,y,sz,fg)=>{
  s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w:sz,h:sz,rectRadius:sz*0.25,fill:{color:NAVY},line:{color:NAVY}});
  s.addShape(pres.shapes.DIAMOND,{x:x+sz*0.18,y:y+sz*0.12,w:sz*0.52,h:sz*0.52,fill:{color:fg||GOLD},line:{color:fg||GOLD}});
  s.addShape(pres.shapes.DIAMOND,{x:x+sz*0.6,y:y+sz*0.58,w:sz*0.26,h:sz*0.26,fill:{color:WHITE},line:{color:WHITE}});
};

const header=(s,title,en)=>{
  s.background={color:WHITE};
  spark(s,0.6,0.38,0.45);
  T(s,title,{x:1.3,y:0.33,w:8.1,h:0.55,fontSize:26,bold:true,color:NAVY,align:'right'});
  if(en) T(s,en,{x:1.3,y:0.88,w:8.1,h:0.28,fontSize:10.5,color:MUTED,align:'right',rtlMode:false,lang:'en-US'});
  T(s,'بديهة · ملف المشروع',{x:0.6,y:5.2,w:3,h:0.25,fontSize:9,color:MUTED,align:'left'});
};

const card=(s,x,y,w,h,title,body,o={})=>{
  box(s,x,y,w,h,o.fill||SOFT,o.line);
  T(s,title,{x:x+0.18,y:y+0.14,w:w-0.36,h:0.32,fontSize:o.tSize||13,bold:true,color:o.tColor||NAVY,align:'right'});
  if(body) T(s,body,{x:x+0.18,y:y+0.5,w:w-0.36,h:h-0.64,fontSize:o.bSize||10,color:o.bColor||INK,align:'right',lineSpacingMultiple:1.14});
};

// ═══════════════════════════════ 1 · الغلاف
{
  const s=pres.addSlide(); s.background={color:NAVY};
  spark(s,4.3,0.85,1.4,GOLD);
  T(s,'بديهة',{x:1,y:2.4,w:8,h:0.8,fontSize:44,bold:true,color:WHITE,align:'center'});
  T(s,'Badiha',{x:1,y:3.15,w:8,h:0.4,fontSize:18,color:GOLD,align:'center',rtlMode:false,lang:'en-US'});
  T(s,'منصة معرفة مؤسسية تجيب موظفي الشركة من مستنداتها هي، بالعربية، مع ذكر المصدر',{x:0.8,y:3.65,w:8.4,h:0.4,fontSize:14,color:WHITE,align:'center'});
  T(s,"Arabic-first enterprise knowledge platform · answers grounded in the company's own documents",{x:0.8,y:4.05,w:8.4,h:0.3,fontSize:10.5,color:'B8C2D6',align:'center',rtlMode:false,lang:'en-US'});
  T(s,'ملف المشروع لطلب رخصة ريادة الأعمال · المؤسِّسة: منال العارقي',{x:1,y:4.8,w:8,h:0.3,fontSize:11,color:'B8C2D6',align:'center'});
}

// ═══════════════════════════════ 2 · المقدمة
{
  const s=pres.addSlide(); header(s,'المقدمة: السياق والتحدي','Introduction');
  card(s,5.1,1.4,4.3,3.6,'السياق الوطني',
    'تضع رؤية ٢٠٣٠ التحول الرقمي والاقتصاد القائم على البيانات في صلب أهدافها، وتقود الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) استراتيجية وطنية لتوطين حلول الذكاء الاصطناعي.\n\nوفي المقابل، معظم معرفة الشركات السعودية محبوسة في ملفات PDF وWord وأرشيفات ممسوحة ضوئيًا، مكتوبة بالعربية، لا تقرؤها الأدوات العالمية كما ينبغي.',{fill:SOFT});
  card(s,0.6,1.4,4.3,3.6,'التحدي الذي تحلّه بديهة',
    '• الموظف يسأل زميله بدل أن يجد الجواب في اللائحة، فتتكرّر الأسئلة نفسها كل يوم.\n\n• الأدوات العامة تخطئ في قراءة ملفات PDF العربية، وتخترع تفاصيل لا وجود لها في السياسة.\n\n• لا أحد يعرف أي الأسئلة بلا جواب موثّق، فتبقى فجوات التوثيق مخفية.\n\n• الأرشيف الممسوح ضوئيًا، وهو جزء كبير من مستندات الشركات، خارج أي بحث.',{fill:WHITE,line:LINE});
}

// ═══════════════════════════════ 4 · نبذة عن المشروع
{
  const s=pres.addSlide(); header(s,'نبذة عن المشروع','About the project');
  T(s,'بديهة منصة سعودية تعمل في الإنتاج اليوم. ترفع الشركة لوائحها وسياساتها وأدلة إجراءاتها، فيسأل موظفوها بالعربية ويحصلون على إجابات مبنية على تلك المستندات وحدها، مع اسم المستند ورقم الصفحة تحت كل إجابة.\n\nوحين لا يجد النظام جوابًا يقول ذلك صراحةً بدل أن يخترع، ويسجّل السؤال في تقرير فجوات المعرفة الذي يوجّه الإدارة إلى ما ينقص توثيقه.\n\nالمنصة متعددة المستأجرين: كل شركة معزولة عن الأخرى داخل قاعدة البيانات، والصلاحيات على مستوى المستند الواحد (الشركة، القسم، الدور).\n\nالنشاط التجاري الرئيسي: تطوير وتشغيل منصة سحابية (SaaS) تُباع باشتراك شهري أو سنوي لمنشآت القطاع الخاص في المملكة. رموز التصنيف الوطني: 620113 (رئيسي)، 620102، 620111، 582001.',
    {x:4.4,y:1.35,w:5.0,h:3.7,fontSize:11.5,align:'right',lineSpacingMultiple:1.18});
  box(s,0.6,1.35,3.5,3.5,WHITE,LINE);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:1.0,y:1.65,w:2.7,h:0.5,rectRadius:0.1,fill:{color:SOFT},line:{color:SOFT}});
  T(s,'كم مدة الإجازة السنوية؟',{x:1.1,y:1.75,w:2.5,h:0.3,fontSize:10,align:'right'});
  box(s,0.8,2.35,3.1,1.5,WHITE,LINE);
  T(s,'٣٠ يومًا بعد إتمام خمس سنوات من الخدمة، و٢١ يومًا قبل ذلك.',{x:0.95,y:2.45,w:2.8,h:0.7,fontSize:10,align:'right',lineSpacingMultiple:1.15});
  s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:1.9,y:3.3,w:1.85,h:0.32,rectRadius:0.16,fill:{color:SOFT},line:{color:SOFT}});
  T(s,'لائحة الموارد البشرية · ص ١٢',{x:1.95,y:3.35,w:1.75,h:0.25,fontSize:8,color:NAVY,align:'center'});
  T(s,'ثقة عالية ✓',{x:0.95,y:3.35,w:0.9,h:0.25,fontSize:8,bold:true,color:GREEN,align:'left'});
  box(s,0.8,4.1,3.1,0.45,WHITE,LINE);
  T(s,'اسأل عن سياسة أو إجراء…',{x:0.95,y:4.2,w:2.8,h:0.25,fontSize:9,color:MUTED,align:'right'});
}

// ═══════════════════════════════ 5 · المميزات المنفَّذة (٢٠ ميزة)
{
  const s=pres.addSlide(); header(s,'المميزات المنفَّذة في المنصة','Shipped product features');
  T(s,'عشرون ميزة تعمل في الإنتاج اليوم، موزّعة على خمسة محاور. لا ميزة هنا قيد التطوير أو موعودة.',
    {x:1.3,y:1.12,w:8.1,h:0.28,fontSize:10,color:MUTED,align:'right'});
  const groups=[
    ['المساعد الذكي','محادثة طبيعية بلا معرفة اسم المستند\nمصادر مع كل إجابة: المستند والصفحة\nعربي وإنجليزي في السؤال والجواب\nسجل محادثات قابل للاستئناف والتقييم'],
    ['الثقة في الإجابة','التحقق من كل رقم ومدة ومبلغ\nدرجة ثقة ظاهرة: عالية · متوسطة · منخفضة\nعرض المصادر المستعملة فعلًا لا كل ما بُحث\nيقول «لم أجد» بدل أن يخترع'],
    ['إدارة المعرفة','رفع ومعالجة PDF وWord وExcel وCSV ونصوص\nتصنيفات معرفة جاهزة أو مخصّصة\nبحث دلالي بالمعنى لا بتطابق الكلمات\nإصدارات المستندات وأرشفة القديم'],
    ['التحكم والصلاحيات','ثلاثة مستويات وصول لكل مستند\nأربعة أدوار مطبَّقة على الخادم\nأقسام تربط الصلاحيات بالتحليلات\nسجل تدقيق لكل عملية حسّاسة'],
    ['الرؤية والتحليلات','فجوات المعرفة بعدّاد تكرار\nإجابات معتمدة تدخل القاعدة فورًا\nتنبيهات داخل المنصة للطرفين\nتحليلات الاستخدام وجودة الإجابات'],
  ];
  groups.forEach(([t,b],i)=>{
    const x=0.55+(4-i)*1.83;
    box(s,x,1.5,1.73,2.95,i%2===0?SOFT:WHITE,i%2===0?null:LINE);
    T(s,t,{x:x+0.14,y:1.64,w:1.45,h:0.5,fontSize:12,bold:true,color:NAVY,align:'right'});
    T(s,b.split('\n').map(l=>'• '+l).join('\n'),{x:x+0.14,y:2.16,w:1.45,h:2.2,fontSize:8.8,align:'right',lineSpacingMultiple:1.12});
  });
  box(s,0.55,4.62,9.0,0.5,SAND,GOLD);
  T(s,'وأربع قنوات للوصول: الويب، وواتساب، ومركز مساعدة بثلاثة عشر مقالًا، ودعم فني بالتذاكر داخل المنصة.',{x:0.75,y:4.75,w:8.6,h:0.3,fontSize:10.5,bold:true,color:NAVY,align:'right'});
}

// ═══════════════════════════════ 5 · الذكاء الاصطناعي والابتكار
{
  const s=pres.addSlide(); header(s,'الذكاء الاصطناعي داخل المنصة','Applied AI: seven roles, two agents');
  box(s,0.6,1.25,8.8,0.58,NAVY);
  T(s,'سبعة أدوار ذكاء اصطناعي مستقلّة، منها وكيلان (★) يتّخذان خطوات بأنفسهما — ولكلٍّ موجّهه ونموذجه وحصته، وتكلفته تُقاس لكل شركة.',
    {x:0.8,y:1.38,w:8.4,h:0.32,fontSize:10.5,bold:true,color:WHITE,align:'right'});
  const roles=[
    ['١ · المساعد الرئيسي','يجيب من مستندات الشركة بصلاحيات السائل'],
    ['٢ · الصياغة الإنقاذية','يعيد صوغ السؤال إن رجع البحث خاويًا'],
    ['٣ · وكيل الفجوة ★','يبحث ثم يصوغ مسودة جواب يعتمدها المدير'],
    ['٤ · مساعد الموقع','يجيب الزوّار بمعزل عن بيانات أي شركة'],
    ['٥ · وكيل واتساب ★','يتحقق من الهوية ثم يجيب بصلاحياتها'],
    ['٦ · عنوان المحادثة','يصوغ عنوانًا قصيرًا لكل محادثة'],
    ['٧ · القراءة الضوئية','ينسخ المسوحات والصور صفحةً صفحة'],
  ];
  roles.forEach(([t,b],i)=>{
    const col=i%4, row=Math.floor(i/4);
    const x=0.6+(3-col)*2.22, y=1.95+row*0.86;
    box(s,x,y,2.12,0.78,row===0?SOFT:WHITE,row===0?null:LINE);
    T(s,t,{x:x+0.12,y:y+0.1,w:1.88,h:0.24,fontSize:10.5,bold:true,color:NAVY,align:'right'});
    T(s,b,{x:x+0.12,y:y+0.36,w:1.88,h:0.36,fontSize:8.5,color:INK,align:'right',lineSpacingMultiple:1.1});
  });
  T(s,'ولا يُستدعى نموذج حيث تكفي الحتمية — أربع ركائز بلا نموذج:',
    {x:0.6,y:3.75,w:8.8,h:0.28,fontSize:11,bold:true,color:NAVY,align:'right'});
  const pillars=[
    ['استرجاع هجين','دلاليّ بالمتجهات + لفظيّ عربي (تطبيع وتجذير داخل القاعدة)، يُدمجان برتبة متبادلة فيُلتقط المعنى والمصطلح الحرفي معًا.'],
    ['إصلاح PDF العربي','أربع دوال تُصلح الحروف المبعثرة ولام-ألف المعكوسة والأرقام المشوّهة، وتقيس جودة الاستخراج وترفض ما لا يصلح.'],
    ['مدقّق حتميّ للأرقام','يقارن كل رقم بنصّ مصدره بعد التوليد — بلا نموذج ثانٍ: لا تكلفة ولا زمن، ولا حَكَم قد يهلوس وهو يحكم على الهلوسة.'],
    ['حصانة ضدّ حقن الأوامر','نصّ المستند بيانات لا تعليمات: تُحيَّد علامات المصادر المزوّرة وعلامات الحدود وعناوين الأقسام.'],
  ];
  pillars.forEach(([t,b],i)=>{
    const x=0.6+(3-i)*2.22;
    box(s,x,4.08,2.12,1.02,SAND,GOLD);
    T(s,t,{x:x+0.12,y:4.16,w:1.88,h:0.24,fontSize:10,bold:true,color:NAVY,align:'right'});
    T(s,b,{x:x+0.12,y:4.4,w:1.88,h:0.62,fontSize:7.6,color:INK,align:'right',lineSpacingMultiple:1.08});
  });
}

// ═══════════════════════════════ 6 · نموذج العمل والسوق والقيمة
{
  const s=pres.addSlide(); header(s,'نموذج العمل والسوق والقيمة','Business model · market · value');
  const q=[
    ['نموذج الإيرادات','اشتراك شهري أو سنوي حسب الحجم:\n• الأساسية ٨٩٩ ريال/شهر\n• النمو ٢٬٤٩٩ ريال/شهر\n• الأعمال ٥٬٩٩٩ ريال/شهر\nتجربة ٧ أيام. ومصادر إضافية: تهيئة الأرشيف، حزم قراءة ضوئية، وقناة شركاء.'],
    ['السوق المستهدف','المنشآت الصغيرة والمتوسطة في المملكة (٢٠ إلى ٥٠٠ موظف) ذات اللوائح الكثيفة: التجزئة والخدمات اللوجستية والرعاية الصحية والخدمات المهنية. الدخول عبر إدارات الموارد البشرية والعمليات.'],
    ['القيمة المضافة للعميل','• جواب موثّق في ثوانٍ بدل بحث في عشرات الملفات\n• توقّف تكرار الأسئلة على الموارد البشرية\n• رؤية إدارية: ما يُسأل وما لا جواب له\n• الأرشيف الممسوح ضوئيًا يصير قابلًا للسؤال'],
    ['الخطة التشغيلية','• السنة ١: الإثبات — ٣ تجارب ثم ٥ عملاء يدفعون\n• السنة ٢: التكرار — مسؤول بيع وقناة شركاء\n• السنة ٣: التعميق — تكاملات وشهادة أمنية\n• السنتان ٤ و٥: التوسع الجغرافي'],
  ];
  q.forEach(([t,b],i)=>{
    const col=i%2,row=Math.floor(i/2);
    card(s,0.6+(1-col)*4.5,1.35+row*1.85,4.3,1.7,t,b,{fill:row===0?SOFT:WHITE,line:row===0?null:LINE,tSize:12.5,bSize:9.5});
  });
}

// ═══════════════════════════════ 10 · المالية والتوظيف
{
  const s=pres.addSlide(); header(s,'المالية والتوظيف لخمس سنوات','Five-year financial & hiring plan');
  T(s,'الإيراد السنوي المتوقع (مليون ريال). الحدّ الأدنى من السيناريو المتحفّظ والأعلى من الأساسي؛ السنتان ٤ و٥ امتداد بالوتيرة نفسها.',
    {x:3.2,y:1.32,w:6.2,h:0.4,fontSize:9.5,color:MUTED,align:'right'});
  const years=['السنة ١','السنة ٢','السنة ٣','السنة ٤','السنة ٥'];
  s.addChart(pres.charts.BAR,[
    {name:'الحد الأدنى',labels:years,values:[0.08,0.35,0.80,1.30,1.90]},
    {name:'الحد الأعلى',labels:years,values:[0.23,0.80,1.69,2.50,3.50]},
  ],{x:3.2,y:1.75,w:6.2,h:3.25,barDir:'col',barGrouping:'clustered',chartColors:[GOLD,NAVY],
     showValue:true,dataLabelPosition:'outEnd',dataLabelFontSize:8,dataLabelColor:INK,dataLabelFormatCode:'0.00',
     catAxisLabelColor:INK,catAxisLabelFontSize:9,valAxisLabelColor:MUTED,valAxisLabelFontSize:8,valAxisMaxVal:4,
     valGridLine:{color:LINE,size:0.5},catGridLine:{style:'none'},showLegend:true,legendPos:'b',legendFontSize:9,legendColor:INK});
  box(s,0.6,1.32,2.4,3.68,SOFT);
  T(s,'الفريق نهاية كل سنة',{x:0.75,y:1.46,w:2.1,h:0.3,fontSize:12,bold:true,color:NAVY,align:'right'});
  [['١','المؤسِّسة'],['٢','+ مسؤول بيع'],['٣–٤','+ نجاح عملاء، مهندس'],['٥','+ مبيعات ثانٍ'],['٦–٧','+ مهندس، دعم']]
   .forEach(([n,r],i)=>{
    const y=1.95+i*0.58;
    T(s,n,{x:2.25,y,w:0.6,h:0.45,fontSize:19,bold:true,color:NAVY,align:'center',valign:'middle'});
    T(s,`السنة ${['١','٢','٣','٤','٥'][i]}`,{x:0.75,y:y+0.02,w:1.45,h:0.2,fontSize:8,color:MUTED,align:'right'});
    T(s,r,{x:0.75,y:y+0.2,w:1.45,h:0.25,fontSize:9.5,color:INK,align:'right'});
  });
}

// ═══════════════════════════════ 8 · الخطوة القادمة والتوسع
{
  const s=pres.addSlide(); header(s,'الخطوة القادمة وخطة التوسع','Next feature & expansion plan');
  box(s,0.6,1.25,8.8,1.72,SAND,GOLD);
  T(s,'الميزة القادمة: استوديو السياسات — مواصفة معتمدة، لم تُنشر بعد، تُبنى بعد العميل الثالث',
    {x:0.8,y:1.37,w:8.4,h:0.3,fontSize:12,bold:true,color:NAVY,align:'right'});
  T(s,'مساعد يساعد الشركة على كتابة سياساتها لا الإجابة منها فقط: يسأل المدير ثلاثة إلى خمسة أسئلة توضيحية، ثم يكتب مسودة مستندة إلى وثائق الشركة وإلى مكتبة مرجعية رسمية (نظام العمل ولوائحه) مع الاستشهاد بمواد النظام؛ يحرّرها المدير ويعتمدها فتدخل قاعدة المعرفة وتُغلق الفجوة.',
    {x:0.8,y:1.72,w:8.4,h:0.62,fontSize:9.8,color:INK,align:'right',lineSpacingMultiple:1.14});
  T(s,'أثرها الاستراتيجي: تقلب الاستبعاد سوقًا — الشركة بلا لوائح مستبعَدة اليوم، وبها تصير العميل المثالي. و٧٠٪ من أجزائها مبنيّ فعلًا في المنصة.',
    {x:0.8,y:2.42,w:8.4,h:0.42,fontSize:9.8,bold:true,color:NAVY,align:'right',lineSpacingMultiple:1.14});
  const stages=[
    ['السنوات ١ إلى ٣','داخل المملكة','الرياض ثم جدة والدمام. بيع مباشر وقناة شركاء، وبناء المراجع والشهادة الأمنية. المنشأة والفريق والاستضافة والعملاء داخل المملكة.'],
    ['السنتان ٤ و٥','دول الخليج','الإمارات وقطر والكويت عبر شركاء محليين، بالمنتج نفسه واللغة نفسها، مع خيار استضافة إقليمية.'],
    ['بعد السنة ٥','الأسواق الناطقة بالعربية','مصر والأردن والمغرب العربي، حيث لا يوجد بديل عربي أولًا وبمعايير أمان مبنية للمؤسسات.'],
  ];
  s.addShape(pres.shapes.LINE,{x:1.2,y:3.7,w:7.6,h:0,line:{color:GOLD,width:2}});
  stages.forEach(([when,where,body],i)=>{
    const x=0.6+(2-i)*3.0;
    s.addShape(pres.shapes.OVAL,{x:x+1.2,y:3.5,w:0.4,h:0.4,fill:{color:i===0?GOLD:WHITE},line:{color:GOLD,width:2}});
    T(s,when,{x,y:3.15,w:2.8,h:0.28,fontSize:9.5,color:MUTED,align:'center'});
    T(s,where,{x,y:4.05,w:2.8,h:0.34,fontSize:14,bold:true,color:NAVY,align:'center'});
    T(s,body,{x:x+0.1,y:4.42,w:2.6,h:0.9,fontSize:9,color:INK,align:'right',lineSpacingMultiple:1.12});
  });
}

pres.writeFile({fileName: process.argv[2]}).then(f=>console.log('wrote',f));
