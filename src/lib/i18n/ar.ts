export const ar = {
  app: {
    title: "JobSync — مساعد البحث عن الوظائف",
    subtitle: "المساعد الذكي لإدارة ومطابقة الوظائف",
  },
  dashboard: {
    title: "لوحة التحكم",
    subtitle: "أنشئ وظائف وأتمتات ومهام وأنشطة وأسئلة وجهات اتصال جديدة.",
  },
  action: {
    addJob: "إضافة وظيفة",
    addAutomation: "إضافة أتمتة",
    addTask: "إضافة مهمة",
    addQuestion: "إضافة سؤال",
    addActivity: "إضافة نشاط",
    addContact: "إضافة جهة اتصال",
  },
  chart: {
    jobsActivity: "الوظائف والنشاط",
    weeklyActivities: "أنشطة الأسبوع",
    weeklyJobs: "وظائف الأسبوع",
    activityCalendar: "تقويم النشاط",
    recentJobs: "أحدث الوظائف",
    totalSpentHours: "إجمالي الساعات المنفقة",
  },
  cat: {
    jobSearch: "البحث عن وظائف",
    interviewPrep: "التحضير للمقابلات",
    sideProject: "مشروع جانبي",
    other: "أخرى",
  },
  range: {
    "7d": "7 أيام",
    "30d": "30 يوماً",
  },
  stats: {
    currentStreak: "السلسلة الحالية",
    bestStreak: "أفضل سلسلة (12 شهراً)",
    bothGoalsMet: "تحقيق الهدفين معاً",
    nothingLogged: "لا شيء مُسجَّل",
    goalHit: "تحقيق الهدف",
    jobsApplied: "الوظائف المُقدَّم عليها",
    activity: "النشاط",
    days: "يوم",
    dailyGoal: "الهدف اليومي",
  },
  status: {
    applied: "تم التقديم",
  },
  job: {
    noDate: "بلا تاريخ",
  },
  chat: {
    ai: "المساعد الذكي",
  },
  empty: {
    noJobs: "لا وظائف بعد",
    noActivity: "لا نشاط مُسجَّل",
  },
} as const;

export type TranslationKeys = typeof ar;
export const AR_LOCALE = "ar-EG-u-nu-latn";
