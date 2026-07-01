/**
 * BIM Insight - データサービス抽象化レイヤー
 * 
 * Supabaseからデータを取得する実装
 */

const Config = {
  SupabaseUrl: "https://nersvbsbchjpvdnrcbcq.supabase.co",
  SupabaseAnonKey: "sb_publishable_8Xr1J_NVpGe1pr1UDEb5iA_-h9oB485",
  TableName: "usage_logs"
};

class DataService {
  constructor() {
    this.source = 'api';
    this.logsPromise = null;
  }

  /**
   * ① usage_logsを取得
   */
  async fetchLogs() {
    if (this.logsPromise) return this.logsPromise;

    this.logsPromise = (async () => {
      const url = `${Config.SupabaseUrl}/rest/v1/${Config.TableName}?select=*`;
      try {
        const res = await fetch(url, {
          headers: {
            'apikey': Config.SupabaseAnonKey,
            'Authorization': `Bearer ${Config.SupabaseAnonKey}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        const cleanedData = data.map(log => {
          // user_name を安全に文字列に変換（null/undefinedは空文字にする）
          let userName = String(log.user_name || '').trim();
          // すべての空白文字（全角・半角）を除去
          userName = userName.replace(/[\s　]+/g, '');
          
          // 名寄せ（「一生」、または未設定の場合は「鈴木一生」に統一）
          if (userName === '一生' || userName === '') {
            userName = '鈴木一生';
          }
          
          // organization を安全に文字列に変換
          let org = String(log.organization || '').trim();
          if (org === '') {
            org = '本社BIM推進部';
          }
          
          return {
            ...log,
            user_name: userName,
            organization: org
          };
        });
        // ② コンソールへ表示
        console.log('Fetched usage_logs from Supabase (cleaned):', cleanedData);
        return cleanedData;
      } catch (error) {
        console.error('Supabase fetch error:', error);
        return [];
      }
    })();

    return this.logsPromise;
  }

  // ユーティリティ：日付を YYYY-MM-DD にフォーマット
  formatDateStr(dateObj) {
    return dateObj.getFullYear() + '-' + 
           String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
           String(dateObj.getDate()).padStart(2, '0');
  }

  // C#から送信される高精度秒数（小数点7桁）のISO8601表記を安全にパースする
  safeParseDate(dateStr) {
    if (!dateStr) return null;
    let sanitized = String(dateStr);
    const match = sanitized.match(/(\.\d{3})\d+/);
    if (match) {
      sanitized = sanitized.replace(match[0], match[1]);
    }
    const d = new Date(sanitized);
    return isNaN(d.getTime()) ? null : d;
  }

  // 常に日本時間の "YYYY-MM-DD"（ゼロ埋め2桁保証）の文字列を取得
  getJstDateStr(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    try {
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(dateObj);
      const map = {};
      parts.forEach(p => map[p.type] = p.value);
      return `${map.year}-${map.month}-${map.day}`;
    } catch (e) {
      console.error('JST Date formatting failed:', e);
      return '';
    }
  }

  // 日本時間基準の曜日インデックス（0:日 〜 6:土）を取得
  getJstDayIndex(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return -1;
    try {
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        weekday: 'short'
      });
      const dayStr = formatter.format(dateObj); // "月", "火" ...
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      return weekDays.indexOf(dayStr);
    } catch (e) {
      return dateObj.getDay();
    }
  }

  roundSecondsToMinutes(seconds) {
    if (!seconds || seconds <= 0) return 0;
    if (seconds < 60) return 1;
    return Math.round(seconds / 60);
  }

  /**
   * ④ 今日の利用時間を取得
   */
  async getTodayUsage() {
    const logs = await this.fetchLogs();
    const today = new Date();
    const todayStr = this.getJstDateStr(today);
    const parts = todayStr.split('-').map(Number);
    const todayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const todayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    
    const userMap = {};
    for (const log of logs) {
      const timeSrc = log.created_at || log.start_time;
      const parsedDate = this.safeParseDate(timeSrc);
      if (!parsedDate) continue;
      
      if (parsedDate >= todayStart && parsedDate <= todayEnd) {
        const userName = log.user_name || 'Unknown';
        if (!userMap[userName]) {
          userMap[userName] = {
            member: { id: userName, name: userName, avatar: userName.charAt(0) },
            seconds: 0
          };
        }
        userMap[userName].seconds += log.duration_seconds || 0;
      }
    }
    
    return Object.values(userMap).map(d => ({
      member: d.member,
      minutes: this.roundSecondsToMinutes(d.seconds)
    }));
  }

  /**
   * 今週の利用時間を取得
   */
  async getWeeklyUsage() {
    const logs = await this.fetchLogs();
    const today = new Date();
    const todayStr = this.getJstDateStr(today);
    const parts = todayStr.split('-').map(Number);
    const todayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const todayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    
    // 今日の日本時間での曜日インデックスを取得 (0:日, 1:月, ... 6:土)
    const currentDayIndex = this.getJstDayIndex(today);

    // 月曜日へのオフセット
    const mondayOffset = currentDayIndex === 0 ? -6 : 1 - currentDayIndex;
    
    // 月曜日の 00:00:00 (JST)
    const mondayStart = new Date(todayStart);
    mondayStart.setDate(todayStart.getDate() + mondayOffset);

    // 週の各日付文字列（月〜金、詳細テーブル描画用）
    const weekDays = ['月', '火', '水', '木', '金'];
    const weekDates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() + mondayOffset + i);
      weekDates.push(this.getJstDateStr(d));
    }

    const userMap = {};

    for (const log of logs) {
      const timeSrc = log.created_at || log.start_time;
      const parsedDate = this.safeParseDate(timeSrc);
      if (!parsedDate) continue;
      
      // 今週の範囲（月曜00:00:00〜今日23:59:59）に入っているか判定 (土日も含める)
      if (parsedDate >= mondayStart && parsedDate <= todayEnd) {
        const userName = log.user_name || 'Unknown';
        if (!userMap[userName]) {
          userMap[userName] = {
            member: { id: userName, name: userName, avatar: userName.charAt(0) },
            dailySeconds: weekDays.map(() => 0),
            totalSeconds: 0
          };
        }

        userMap[userName].totalSeconds += log.duration_seconds || 0;
        
        // 月〜金の日別集計用
        const logDateStr = this.getJstDateStr(parsedDate);
        const dayIndex = weekDates.indexOf(logDateStr);
        if (dayIndex !== -1) {
          userMap[userName].dailySeconds[dayIndex] += log.duration_seconds || 0;
        }
      }
    }

    return Object.values(userMap).map(d => ({
      member: d.member,
      daily: weekDays.map((day, idx) => ({
        day,
        minutes: this.roundSecondsToMinutes(d.dailySeconds[idx])
      })),
      totalMinutes: this.roundSecondsToMinutes(d.totalSeconds)
    }));
  }

  /**
   * 今月の利用時間を取得
   */
  async getMonthlyUsage() {
    const logs = await this.fetchLogs();
    const today = new Date();
    const todayStr = this.getJstDateStr(today);
    const parts = todayStr.split('-').map(Number);
    const todayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    
    // 月初 00:00:00 (JST)
    const monthStart = new Date(parts[0], parts[1] - 1, 1, 0, 0, 0);
    
    const userMap = {};
    for (const log of logs) {
      const timeSrc = log.created_at || log.start_time;
      const parsedDate = this.safeParseDate(timeSrc);
      if (!parsedDate) continue;
      
      // 今月の範囲（月初00:00:00〜今日23:59:59）に入っているか判定
      if (parsedDate >= monthStart && parsedDate <= todayEnd) {
        const userName = log.user_name || 'Unknown';
        if (!userMap[userName]) {
          userMap[userName] = {
            member: { 
              id: userName, 
              name: userName, 
              avatar: userName.charAt(0),
              department: log.organization || '本社BIM推進部'
            },
            totalSeconds: 0
          };
        } else if (log.organization) {
          userMap[userName].member.department = log.organization;
        }
        userMap[userName].totalSeconds += log.duration_seconds || 0;
      }
    }
    
    return Object.values(userMap).map(d => {
      const minutes = this.roundSecondsToMinutes(d.totalSeconds);
      return {
        member: d.member,
        minutes: minutes,
        hours: minutes / 60
      };
    });
  }

  /**
   * ⑥ 利用時間ランキング
   */
  async getMonthlyRanking() {
    const monthlyData = await this.getMonthlyUsage();
    return monthlyData
      .sort((a, b) => b.hours - a.hours)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  /**
   * 今日の最大同時利用人数を計算する
   */
  async getTodayMaxConcurrentUsers() {
    const logs = await this.fetchLogs();
    const todayStr = this.getJstDateStr(new Date());
    
    // 今日のログのみを抽出する
    const todayLogs = [];
    for (const log of logs) {
      const timeSrc = log.created_at || log.start_time;
      const parsedDate = this.safeParseDate(timeSrc);
      if (!parsedDate) continue;
      
      const logDateStr = this.getJstDateStr(parsedDate);
      if (logDateStr === todayStr) {
        todayLogs.push({
          start: parsedDate,
          end: new Date(parsedDate.getTime() + (log.duration_seconds || 0) * 1000)
        });
      }
    }
    
    // イベントを作成する
    const events = [];
    todayLogs.forEach(log => {
      events.push({ time: log.start.getTime(), type: 1 });
      events.push({ time: log.end.getTime(), type: -1 });
    });
    
    // 時間順にソート (同じ時間の場合は終了イベント -1 を優先することで同時利用数を過大評価しないようにする)
    events.sort((a, b) => a.time - b.time || a.type - b.type);
    
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    
    for (const ev of events) {
      currentConcurrent += ev.type;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
    }
    
    return maxConcurrent;
  }

  /**
   * ⑤ 今日の利用人数など
   */
  async getDashboardMetrics() {
    const todayData = await this.getTodayUsage();
    const maxConcurrent = await this.getTodayMaxConcurrentUsers();
    
    // LocalStorage から契約ライセンス数を取得
    const savedLicenses = localStorage.getItem('bim_insight_licenses');
    const contractLicenses = savedLicenses ? parseInt(savedLicenses, 10) : 8;
    
    return {
      todayActiveUsers: todayData.length, // ⑤ 今日の利用人数
      maxSimultaneousLicenses: maxConcurrent,
      contractLicenses: contractLicenses
    };
  }

  /**
   * 直近7日間の日別合計利用時間（時間単位）を取得
   */
  async getDailyUsageReport() {
    const logs = await this.fetchLogs();
    const result = [];
    const today = new Date();
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];

    // 今日から遡って7日間のデータを集計
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = this.getJstDateStr(date);
      
      const dayIndex = this.getJstDayIndex(date);
      const dayName = daysOfWeek[dayIndex];

      let totalSeconds = 0;
      for (const log of logs) {
        const timeSrc = log.created_at || log.start_time;
        const parsedDate = this.safeParseDate(timeSrc);
        if (!parsedDate) continue;
        
        const logDateStr = this.getJstDateStr(parsedDate);
        if (logDateStr === dateStr) {
          totalSeconds += log.duration_seconds || 0;
        }
      }

      result.push({
        day: dayName,
        minutes: totalSeconds / 60, // 正確な時間表示用
        hours: totalSeconds / 3600 // グラフ描画用
      });
    }

    return result;
  }

  /**
   * usage_logsのテストデータをすべて削除する
   */
  async clearAllLogs() {
    // 1. 現在のAPIキーからデバッグ情報を出力
    try {
      const token = Config.SupabaseAnonKey;
      const payloadBase64 = token.split('.')[1];
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      console.log("[Supabase Auth Debug] Token Role:", payload.role);
      console.log("[Supabase Auth Debug] auth.uid():", payload.sub || "null (Not Authenticated)");
    } catch (e) {
      console.warn("[Supabase Auth Debug] Failed to parse AnonKey JWT:", e);
    }

    // PostgRESTの無条件削除制限を回避するために全件マッチする条件を付与
    const url = `${Config.SupabaseUrl}/rest/v1/${Config.TableName}?id=not.is.null`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': Config.SupabaseAnonKey,
          'Authorization': `Bearer ${Config.SupabaseAnonKey}`,
          'Prefer': 'return=representation'
        }
      });
      
      if (!res.ok) {
        let errMsg = `HTTP error! status: ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.message) {
            errMsg = `${errData.message} (${errData.details || ''})`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
      
      const deletedRows = await res.json();
      console.log(`[Supabase DELETE] 削除件数: ${deletedRows.length} 件`);
      
      // ローカルのキャッシュをクリア
      this.logsPromise = null;
      
      // 削除後のデータを再取得して0件確認 (二重チェック)
      const currentLogs = await this.fetchLogs();
      console.log(`[Supabase DELETE] 削除後のデータ残存件数: ${currentLogs.length} 件`);
      
      if (currentLogs.length > 0) {
        throw new Error(`削除を実行しましたが、データが消去されませんでした（残存: ${currentLogs.length}件）。Supabaseの行セキュリティ(RLS)ポリシーでDELETE権限が許可されていない可能性があります。`);
      }
      
      return true;
    } catch (error) {
      console.error("Failed to delete all logs:", error);
      throw error;
    }
  }
}

// グローバルに公開
window.dataService = new DataService();
