# Cizaro Studio

نظام إدارة تاسكات التصميم بين الإدارة وفريق الجرافيك، بستايل Apple: بورد Kanban، بريفات، مواعيد تسليم، رفع ملفات، ودورة مراجعة واعتماد.

## المميزات

- **بورد Kanban** بخمس مراحل: جديد ← شغّال عليه ← في المراجعة ← تعديلات ← اتسلّم، بالسحب والإفلات.
- **عرض قائمة** متقسّم حسب الميعاد: متأخرة، النهارده وبكرة، الأسبوع ده، بعدين.
- **فلاتر سريعة** على طريقة Reminders: النهارده، المتأخرة، المستنية مراجعة، تاسكاتي. وكمان فلترة بالمصمم والنوع وبحث.
- **دورة المراجعة**: المصمم يرفع التسليم ويبعته للمراجعة، والمدير يعتمده أو يطلب تعديلات مكتوبة. كل جولة تعديل بتتعد (R1، R2…).
- **الملفات**: مراجع وتسليمات (لحد 50MB للملف، أي صيغة بما فيها PSD و AI)، أو لينكات Drive / WeTransfer. آخر صورة تسليم بتظهر كغلاف على الكارت.
- **سجل نشاط وتعليقات** على كل تاسك.
- **الصلاحيات**: المدير بيضيف أعضاء الفريق، بيعتمد، بيطلب تعديلات، وبيحذف. المصمم بيشتغل، بيرفع، وبيبعت للمراجعة.
- عربي بالكامل (RTL)، Light و Dark mode، وشغال على الموبايل.

## التشغيل محلياً

محتاج Node.js 20 أو أحدث.

```bash
npm install
cp .env.example .env        # عدّل SESSION_SECRET وبيانات المدير
npm run setup               # بيعمل قاعدة البيانات وحساب المدير
npm run dev                 # http://localhost:3000
```

ادخل بإيميل وباسورد المدير اللي في `.env`، وبعدها من صفحة **الفريق** ضيف المصممين وابعتلهم بيانات الدخول.

## الرفع على سيرفر

### سيرفر أو VPS (الأبسط)

SQLite والملفات بيتحفظوا على الديسك، فأي سيرفر Node بيكفي:

```bash
npm ci
npm run build
npm run setup
npm start                   # PORT=3000 افتراضياً
```

أو بـ Docker:

```bash
docker build -t cizaro-studio .
docker run -d -p 3000:3000 --env-file .env -v cizaro-data:/data cizaro-studio
```

الـ volume `/data` فيه قاعدة البيانات والملفات المرفوعة، فخد منه backup بشكل دوري.

### Railway / Render

اربط الريبو، ضيف المتغيرات اللي في `.env.example`، وضيف Volume على `/data` مع `DATABASE_URL=file:/data/cizaro.db` و `STORAGE_DIR=/data/storage`.

### Vercel

Vercel مفيهوش ديسك دائم، فلازم:
1. تغيّر `provider` في `prisma/schema.prisma` لـ `postgresql` وتحط `DATABASE_URL` لقاعدة Postgres (Neon أو Supabase).
2. تنقل تخزين الملفات لـ object storage (S3 / R2 / Vercel Blob) بدل `src/lib/storage.ts`.

## التقنيات

Next.js 15 (App Router) · React 19 · Prisma · SQLite · جلسات JWT في كوكي httpOnly · bcrypt للباسوردات.

## هيكل المشروع

```
prisma/schema.prisma        جداول: User, Task, Activity, File
src/app/api/…               الـ API: تسجيل الدخول، التاسكات، الحالات، التعليقات، الملفات، الفريق
src/components/Studio.tsx   البورد والقائمة والفلاتر
src/components/TaskSheet.tsx شيت تفاصيل التاسك والمراجعة والملفات
src/components/Team.tsx     إدارة الفريق (للمدير)
src/app/globals.css         الـ design tokens والستايل
```
