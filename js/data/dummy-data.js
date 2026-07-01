/**
 * BIM Insight - ダミーデータモジュール
 * 
 * 将来的にArchicadアドオン連携に置き換える際は、
 * data-service.js のデータソースをAPIに切り替えるだけでOK。
 */

const MEMBERS = [
  { id: 1, name: '多田幸弘', department: 'BIM推進部', avatar: '多田' },
  { id: 2, name: '山下順平', department: 'BIM推進部', avatar: '山下' },
  { id: 3, name: '中井健太郎', department: 'BIM推進部', avatar: '中井' },
  { id: 4, name: '大田真鈴', department: 'BIM推進部', avatar: '大田' },
  { id: 5, name: '川又慶太', department: 'BIM推進部', avatar: '川又' },
  { id: 6, name: '桑原志保', department: 'BIM推進部', avatar: '桑原' },
  { id: 7, name: '藤田紗代', department: 'BIM推進部', avatar: '藤田' },
  { id: 8, name: '鈴木一生', department: 'BIM推進部', avatar: '鈴木' },
];

/**
 * 今日の利用時間（分単位）
 */
function generateTodayUsage() {
  const usages = [
    { memberId: 1, minutes: 342 },
    { memberId: 2, minutes: 285 },
    { memberId: 3, minutes: 198 },
    { memberId: 4, minutes: 410 },
    { memberId: 5, minutes: 156 },
    { memberId: 6, minutes: 375 },
    { memberId: 7, minutes: 220 },
    { memberId: 8, minutes: 305 },
  ];
  return usages;
}

/**
 * 今週の利用時間（分単位）
 * 月〜金の各日の利用時間
 */
function generateWeeklyUsage() {
  const days = ['月', '火', '水', '木', '金'];
  return MEMBERS.map(member => ({
    memberId: member.id,
    daily: days.map((day, i) => ({
      day,
      minutes: Math.floor(Math.random() * 300 + 120),
    })),
    totalMinutes: 0, // 後で計算
  })).map(entry => {
    entry.totalMinutes = entry.daily.reduce((sum, d) => sum + d.minutes, 0);
    return entry;
  });
}

// 固定のダミーデータ（再現性のため）
const WEEKLY_USAGE = [
  { memberId: 1, daily: [
    { day: '月', minutes: 380 }, { day: '火', minutes: 420 }, { day: '水', minutes: 350 },
    { day: '木', minutes: 290 }, { day: '金', minutes: 342 }
  ], totalMinutes: 1782 },
  { memberId: 2, daily: [
    { day: '月', minutes: 310 }, { day: '火', minutes: 285 }, { day: '水', minutes: 400 },
    { day: '木', minutes: 350 }, { day: '金', minutes: 285 }
  ], totalMinutes: 1630 },
  { memberId: 3, daily: [
    { day: '月', minutes: 200 }, { day: '火', minutes: 180 }, { day: '水', minutes: 250 },
    { day: '木', minutes: 220 }, { day: '金', minutes: 198 }
  ], totalMinutes: 1048 },
  { memberId: 4, daily: [
    { day: '月', minutes: 450 }, { day: '火', minutes: 400 }, { day: '水', minutes: 380 },
    { day: '木', minutes: 420 }, { day: '金', minutes: 410 }
  ], totalMinutes: 2060 },
  { memberId: 5, daily: [
    { day: '月', minutes: 150 }, { day: '火', minutes: 200 }, { day: '水', minutes: 180 },
    { day: '木', minutes: 170 }, { day: '金', minutes: 156 }
  ], totalMinutes: 856 },
  { memberId: 6, daily: [
    { day: '月', minutes: 360 }, { day: '火', minutes: 390 }, { day: '水', minutes: 340 },
    { day: '木', minutes: 380 }, { day: '金', minutes: 375 }
  ], totalMinutes: 1845 },
  { memberId: 7, daily: [
    { day: '月', minutes: 240 }, { day: '火', minutes: 210 }, { day: '水', minutes: 260 },
    { day: '木', minutes: 230 }, { day: '金', minutes: 220 }
  ], totalMinutes: 1160 },
  { memberId: 8, daily: [
    { day: '月', minutes: 320 }, { day: '火', minutes: 290 }, { day: '水', minutes: 350 },
    { day: '木', minutes: 310 }, { day: '金', minutes: 305 }
  ], totalMinutes: 1575 },
];

/**
 * 今月の利用時間（時間単位）
 */
const MONTHLY_USAGE = [
  { memberId: 1, hours: 142.5 },
  { memberId: 2, hours: 128.3 },
  { memberId: 3, hours: 89.7 },
  { memberId: 4, hours: 168.2 },
  { memberId: 5, hours: 72.4 },
  { memberId: 6, hours: 155.8 },
  { memberId: 7, hours: 95.6 },
  { memberId: 8, hours: 118.9 },
];

// ダッシュボード用の追加指標メトリクス
const DASHBOARD_METRICS = {
  todayActiveUsers: 7,
  maxSimultaneousLicenses: 4
};

// エクスポート
window.DummyData = {
  MEMBERS,
  getTodayUsage: generateTodayUsage,
  WEEKLY_USAGE,
  MONTHLY_USAGE,
  DASHBOARD_METRICS,
};
