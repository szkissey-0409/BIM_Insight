/**
 * BIM Insight - メインアプリケーション
 * 
 * ダッシュボードのレンダリングとインタラクションを管理
 */

document.addEventListener('DOMContentLoaded', async () => {
  const syncedUser = await syncUserFromAgent();
  initUserSetup(syncedUser);
  initNavigation();
  await renderDashboard();
});

/**
 * AgentのローカルAPIからユーザー設定を同期する
 */
async function syncUserFromAgent() {
  try {
    const res = await fetch('http://localhost:32115/api/user');
    if (res.ok) {
      const data = await res.json();
      if (data.fullName && data.organization) {
        const userData = {
          fullName: data.fullName,
          department: data.organization, // UI表示用
          organization: data.organization
        };
        localStorage.setItem('bim_insight_user', JSON.stringify(userData));
        return userData;
      }
    }
  } catch (error) {
    console.warn('[Agent Sync] Agentに接続できないか、設定がありません:', error);
  }
  return null;
}

/**
 * AgentのローカルAPIへユーザー設定を保存する
 */
async function saveUserToAgent(fullName, organization) {
  try {
    const res = await fetch('http://localhost:32115/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fullName, organization })
    });
    if (res.ok) {
      console.log('[Agent Sync] Agentへ設定を保存しました。');
    } else {
      console.error('[Agent Sync] Agentへの設定保存に失敗しました:', res.statusText);
    }
  } catch (error) {
    console.warn('[Agent Sync] Agentに接続できませんでした:', error);
  }
}

/**
 * 初回起動セットアップ処理
 */
function initUserSetup(syncedUser) {
  const user = syncedUser || JSON.parse(localStorage.getItem('bim_insight_user') || 'null');
  const modal = document.getElementById('setup-modal');
  const form = document.getElementById('setup-form');

  if (!user) {
    // ユーザー情報がない場合（初回起動時）：モーダルを表示
    if (modal) {
      modal.style.display = 'flex';
    }
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('setup-fullname').value.trim();
        const department = document.getElementById('setup-department').value;

        if (fullName && department) {
          const userData = { fullName, department, organization: department };
          localStorage.setItem('bim_insight_user', JSON.stringify(userData));

          // Agentへ保存
          await saveUserToAgent(fullName, department);

          if (modal) {
            modal.style.display = 'none';
          }

          displayUserProfile(userData);
        }
      });
    }
  } else {
    // 登録済みの場合はプロフィール表示のみ
    displayUserProfile(user);
  }
}

/**
 * サイドバーにユーザープロフィールを表示
 */
function displayUserProfile(userData) {
  const sidebarUser = document.getElementById('sidebar-user');
  const userNameEl = document.getElementById('user-name');
  const userDeptEl = document.getElementById('user-dept');
  const userAvatarEl = document.getElementById('user-avatar');

  if (sidebarUser && userNameEl && userDeptEl && userAvatarEl) {
    userNameEl.textContent = userData.fullName;
    userDeptEl.textContent = userData.department || userData.organization;
    
    // アバター表示：スペース区切りがあれば苗字（最大3文字）、なければ最初の2文字を使用
    const nameParts = userData.fullName.split(/[\s　]+/);
    let avatarText = '👤';
    if (nameParts.length > 0 && nameParts[0]) {
      avatarText = nameParts[0].substring(0, 3);
    } else {
      avatarText = userData.fullName.substring(0, 2);
    }
    
    userAvatarEl.textContent = avatarText;
    sidebarUser.style.display = 'flex';
  }
}

/**
 * 利用時間を要件に従いフォーマットする
 * 1時間未満: ○分
 * 1時間以上: ○.○時間
 */
function formatTimeDisplay(minutes) {
  if (!minutes || isNaN(minutes) || minutes === 0) return `0<span class="unit">分</span>`;
  
  // 1分未満の実績がある場合は切り上げて1分以上にする
  let totalMinutes = minutes > 0 && minutes < 1 ? 1 : Math.round(minutes);
  if (totalMinutes === 0) return `0<span class="unit">分</span>`;
  
  if (totalMinutes < 60) {
    return `${totalMinutes}<span class="unit">分</span>`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      return `${hours}<span class="unit">時間</span>`;
    } else {
      return `${hours}<span class="unit">時間</span>${mins}<span class="unit">分</span>`;
    }
  }
}



/**
 * 現在の日付情報を取得
 */
function getDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekDay = weekDays[now.getDay()];
  return { year, month, day, weekDay };
}

/**
 * メインダッシュボードをレンダリング
 */
async function renderDashboard() {
  const todayData = await dataService.getTodayUsage();
  const weeklyData = await dataService.getWeeklyUsage();
  const monthlyData = await dataService.getMonthlyUsage();
  const ranking = await dataService.getMonthlyRanking();
  const metrics = await dataService.getDashboardMetrics();

  const dateInfo = getDateInfo();

  // ヘッダーの日付を設定
  const headerDate = document.getElementById('header-date');
  if (headerDate) {
    headerDate.textContent = `${dateInfo.year}年${dateInfo.month}月${dateInfo.day}日（${dateInfo.weekDay}）`;
  }

  // サマリーカードを描画
  renderSummaryCards(todayData, weeklyData, monthlyData, metrics);

  // 今日のメンバー別利用時間
  renderTodayMemberCards(todayData);

  // 下段：ランキング＆今週テーブル
  renderBottomSection(ranking, weeklyData);
}

/**
 * サマリーカード4枚を描画
 */
function renderSummaryCards(todayData, weeklyData, monthlyData, metrics) {
  const totalToday = todayData.reduce((sum, d) => sum + d.minutes, 0);
  const totalWeek = weeklyData.reduce((sum, d) => sum + d.totalMinutes, 0);
  const totalMonth = monthlyData.reduce((sum, d) => sum + d.minutes, 0);
  const avgToday = todayData.length > 0 ? Math.round(totalToday / todayData.length) : 0;

  const todayUsersCount = metrics ? metrics.todayActiveUsers : 7;
  const maxLicenses = metrics ? metrics.maxSimultaneousLicenses : 4;

  const container = document.getElementById('summary-grid');
  container.innerHTML = `
    <div class="summary-card animate-in delay-1">
      <div class="summary-card-header">
        <div class="summary-card-icon today">⏱️</div>
        <span class="summary-card-badge">+12%</span>
      </div>
      <div class="summary-card-label">今日のチーム合計</div>
      <div class="summary-card-value">
        ${formatTimeDisplay(totalToday)}
      </div>
      <div class="summary-card-sub">8メンバーの合計利用時間</div>
    </div>

    <div class="summary-card animate-in delay-2">
      <div class="summary-card-header">
        <div class="summary-card-icon week">📊</div>
        <span class="summary-card-badge">+8%</span>
      </div>
      <div class="summary-card-label">今週のチーム合計</div>
      <div class="summary-card-value">
        ${formatTimeDisplay(totalWeek)}
      </div>
      <div class="summary-card-sub">月〜金の累計</div>
    </div>

    <div class="summary-card animate-in delay-3">
      <div class="summary-card-header">
        <div class="summary-card-icon month">📅</div>
        <span class="summary-card-badge">+5%</span>
      </div>
      <div class="summary-card-label">今月のチーム合計</div>
      <div class="summary-card-value">
        ${formatTimeDisplay(totalMonth)}
      </div>
      <div class="summary-card-sub">${getDateInfo().month}月の累計</div>
    </div>

    <div class="summary-card animate-in delay-4">
      <div class="summary-card-header">
        <div class="summary-card-icon avg">👤</div>
      </div>
      <div class="summary-card-label">今日の平均利用時間</div>
      <div class="summary-card-value">
        ${formatTimeDisplay(avgToday)}
      </div>
      <div class="summary-card-sub">1人あたり平均</div>
    </div>

    <div class="summary-card animate-in delay-5">
      <div class="summary-card-header">
        <div class="summary-card-icon users">👥</div>
      </div>
      <div class="summary-card-label">今日の利用人数</div>
      <div class="summary-card-value">
        ${todayUsersCount}<span class="unit">人</span>
      </div>
      <div class="summary-card-sub">アクティブなメンバー数</div>
    </div>

    <div class="summary-card animate-in delay-6">
      <div class="summary-card-header">
        <div class="summary-card-icon licenses">🔑</div>
      </div>
      <div class="summary-card-label">最大同時利用ライセンス数</div>
      <div class="summary-card-value">
        ${maxLicenses}<span class="unit">ライセンス</span>
      </div>
      <div class="summary-card-sub">契約ライセンス数: ${metrics ? metrics.contractLicenses : 8}</div>
    </div>
  `;
}

/**
 * 今日のメンバー別カードを描画
 */
function renderTodayMemberCards(todayData) {
  const maxMinutes = Math.max(...todayData.map(d => d.minutes));
  const container = document.getElementById('today-member-grid');

  const cards = todayData.map((data, i) => {
    const progressPercent = Math.round((data.minutes / maxMinutes) * 100);
    const statusText = data.minutes > 300 ? 'アクティブ' : data.minutes > 180 ? '利用中' : '少なめ';
    return `
      <div class="member-card animate-in delay-${i + 1}">
        <div class="member-card-top">
          <div>
            <div class="member-name">${data.member.name}</div>
            <div class="member-status">${statusText}</div>
          </div>
        </div>
        <div class="member-card-value">
          ${formatTimeDisplay(data.minutes)}
        </div>
        <div class="member-progress">
          <div class="member-progress-bar" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cards;
}

/**
 * 下段セクション（ランキング＆週間テーブル）を描画
 */
function renderBottomSection(ranking, weeklyData) {
  const container = document.getElementById('bottom-section');
  const maxHours = ranking.length > 0 ? ranking[0].hours : 1;

  // ランキングリスト
  const rankingItems = ranking.map((entry) => {
    const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : 'rank-other';
    const barPercent = Math.round((entry.hours / maxHours) * 100);
    return `
      <div class="ranking-item">
        <div class="ranking-position ${rankClass}">${entry.rank}</div>
        <div class="ranking-info">
          <div class="ranking-name">${entry.member.name}</div>
        </div>
        <div class="ranking-bar-wrapper">
          <div class="ranking-bar">
            <div class="ranking-bar-fill ${rankClass}" style="width: ${barPercent}%"></div>
          </div>
        </div>
        <div class="ranking-value">${formatTimeDisplay(entry.hours * 60)}</div>
      </div>
    `;
  }).join('');

  // 週間テーブル
  const weeklyRows = weeklyData
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map(entry => {
      const maxDayMin = Math.max(...entry.daily.map(d => d.minutes));
      const dailyCells = entry.daily.map(d => {
        const highlight = d.minutes === maxDayMin ? 'time-highlight' : '';
        return `<td class="time-cell ${highlight}">${formatTimeDisplay(d.minutes)}</td>`;
      }).join('');
      return `
        <tr>
          <td>
            <div class="member-cell">
              <span>${entry.member.name}</span>
            </div>
          </td>
          ${dailyCells}
          <td>${formatTimeDisplay(entry.totalMinutes)}</td>
        </tr>
      `;
    }).join('');

  container.innerHTML = `
    <div class="content-grid animate-in delay-7">
      <div class="ranking-card">
        <div class="ranking-card-header">
          <div class="ranking-card-title">🏆 今月の利用時間ランキング</div>
        </div>
        <div class="ranking-list">
          ${rankingItems}
        </div>
      </div>

      <div class="weekly-detail-card">
        <div class="weekly-detail-header">
          <div class="weekly-detail-title">📋 今週の日別利用時間</div>
        </div>
        <table class="weekly-table">
          <thead>
            <tr>
              <th>メンバー</th>
              <th>月</th>
              <th>火</th>
              <th>水</th>
              <th>木</th>
              <th>金</th>
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            ${weeklyRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * ナビゲーション切り替え処理
 */
function initNavigation() {
  const navItems = {
    'nav-dashboard': { viewId: 'view-dashboard', title: 'ダッシュボード', render: renderDashboard },
    'nav-members': { viewId: 'view-members', title: 'メンバー一覧', render: renderMembersView },
    'nav-ranking': { viewId: 'view-ranking', title: 'ランキング', render: renderRankingView },
    'nav-daily': { viewId: 'view-daily', title: '日別レポート', render: renderDailyReportView },
    'nav-weekly': { viewId: 'view-weekly', title: '週間レポート', render: renderWeeklyReportView },
    'nav-monthly': { viewId: 'view-monthly', title: '月間レポート', render: renderMonthlyReportView },
    'nav-settings': { viewId: 'view-settings', title: '設定', render: renderSettingsView }
  };

  Object.keys(navItems).forEach(navId => {
    const navEl = document.getElementById(navId);
    if (navEl) {
      navEl.addEventListener('click', async (e) => {
        e.preventDefault();

        // 1. active クラスの切り替え
        Object.keys(navItems).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.remove('active');
        });
        navEl.classList.add('active');

        // 2. タイトルの切り替え
        const titleEl = document.querySelector('.header-title');
        if (titleEl) {
          titleEl.textContent = navItems[navId].title;
        }

        // 3. 画面の切り替え
        Object.values(navItems).forEach(item => {
          const viewEl = document.getElementById(item.viewId);
          if (viewEl) viewEl.style.display = 'none';
        });
        
        const activeView = document.getElementById(navItems[navId].viewId);
        if (activeView) {
          activeView.style.display = 'block';
        }

        // 4. データ描画
        await navItems[navId].render();
      });
    }
  });

  // 設定フォームの送信イベントを初期化
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('settings-fullname').value.trim();
      const department = document.getElementById('settings-department').value;
      const licenses = parseInt(document.getElementById('settings-licenses').value, 10) || 8;

      if (fullName && department) {
        const userData = { fullName, department, organization: department };
        localStorage.setItem('bim_insight_user', JSON.stringify(userData));
        localStorage.setItem('bim_insight_licenses', licenses);

        // Agentへ保存
        await saveUserToAgent(fullName, department);

        // サイドバーと入力フィールドを即座に更新
        displayUserProfile(userData);
        alert('設定を保存しました。');
      }
    });
  }

  // 管理者専用テストデータ削除イベントのバインド
  const clearBtn = document.getElementById('admin-clear-data-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('本当にテストデータを削除しますか？')) {
        try {
          await dataService.clearAllLogs();
          alert('テストデータを削除しました。');
          // ページをリロードして全画面を確実に0分（初期状態）で再描画する
          window.location.reload();
        } catch (error) {
          alert('テストデータの削除に失敗しました:\n' + error.message);
        }
      }
    });
  }
}

/**
 * メンバー一覧画面の描画
 */
async function renderMembersView() {
  const container = document.getElementById('all-members-grid');
  if (!container) return;

  const logs = await dataService.fetchLogs();
  const todayData = await dataService.getTodayUsage();

  // 全ログからユニークなユーザー名（user_name）と直近の所属（organization）を抽出
  const memberMap = {};
  for (const log of logs) {
    const userName = log.user_name;
    if (!userName) continue;

    // より新しい所属（もしあれば）を取得するため、時系列的に上書き
    if (!memberMap[userName]) {
      memberMap[userName] = {
        name: userName,
        department: log.organization || '所属不明',
        avatar: userName.substring(0, 2)
      };
    } else if (log.organization) {
      memberMap[userName].department = log.organization;
    }
  }

  const members = Object.values(memberMap);

  const cards = members.map((member, i) => {
    const todayEntry = todayData.find(d => d.member.name === member.name);
    const minutes = todayEntry ? todayEntry.minutes : 0;
    
    const statusText = minutes > 300 ? 'アクティブ' : minutes > 180 ? '利用中' : minutes > 0 ? '稼働終了' : '本日未稼働';
    const statusClass = minutes > 0 ? 'active' : 'inactive';
    
    return `
      <div class="member-card animate-in delay-${(i % 8) + 1}">
        <div class="member-card-top">
          <div>
            <div class="member-name">${member.name}</div>
            <div class="member-status ${statusClass}">${statusText}</div>
          </div>
        </div>
        <div class="member-card-value">
          <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: normal; margin-right: 4px;">今日:</span>
          ${formatTimeDisplay(minutes)}
        </div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-2);">
          所属：${member.department}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cards;
}

/**
 * ランキング詳細画面の描画
 */
async function renderRankingView() {
  const container = document.getElementById('detail-ranking-list');
  if (!container) return;

  const ranking = await dataService.getMonthlyRanking();
  const maxHours = ranking.length > 0 ? ranking[0].hours : 1;

  const rankingItems = ranking.map((entry) => {
    const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : 'rank-other';
    const barPercent = Math.round((entry.hours / maxHours) * 100);
    return `
      <div class="ranking-item animate-in" style="padding: var(--space-3) var(--space-4);">
        <div class="ranking-position ${rankClass}">${entry.rank}</div>
        <div class="ranking-info">
          <div>
            <div class="ranking-name">${entry.member.name}</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: normal;">${entry.member.department || 'BIM推進部'}</div>
          </div>
        </div>
        <div class="ranking-bar-wrapper" style="flex: 1; margin: 0 var(--space-6);">
          <div class="ranking-bar" style="height: 10px;">
            <div class="ranking-bar-fill ${rankClass}" style="width: ${barPercent}%"></div>
          </div>
        </div>
        <div class="ranking-value" style="font-size: var(--text-base); font-weight: 600;">${formatTimeDisplay(entry.hours * 60)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = rankingItems;
}

/**
 * 日別レポート画面の描画
 */
async function renderDailyReportView() {
  const container = document.getElementById('daily-report-list');
  if (!container) return;

  const dailyData = await dataService.getDailyUsageReport();
  const maxHours = Math.max(...dailyData.map(d => d.hours), 1);

  const items = dailyData.map((d, i) => {
    const barPercent = Math.round((d.hours / maxHours) * 100);
    return `
      <div class="ranking-item animate-in delay-${i + 1}" style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border);">
        <div style="font-weight: 600; width: 40px; color: var(--color-text-primary);">${d.day}曜日</div>
        <div class="ranking-bar-wrapper" style="flex: 1; margin: 0 var(--space-6);">
          <div class="ranking-bar" style="height: 12px; background: rgba(255, 255, 255, 0.05); border-radius: var(--radius-sm);">
            <div class="ranking-bar-fill rank-1" style="width: ${barPercent}%; background: var(--color-accent-gradient);"></div>
          </div>
        </div>
        <div style="font-weight: 600; width: 80px; text-align: right;">${formatTimeDisplay(d.minutes)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

/**
 * 週間レポート詳細画面の描画
 */
async function renderWeeklyReportView() {
  const container = document.getElementById('detail-weekly-rows');
  if (!container) return;

  const weeklyData = await dataService.getWeeklyUsage();
  const dataToUse = weeklyData;

  const weeklyRows = dataToUse
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map(entry => {
      const maxDayMin = Math.max(...entry.daily.map(d => d.minutes), 1);
      const dailyCells = entry.daily.map(d => {
        const highlight = d.minutes === maxDayMin ? 'time-highlight' : '';
        return `<td class="time-cell ${highlight}">${formatTimeDisplay(d.minutes)}</td>`;
      }).join('');
      
      return `
        <tr>
          <td>
            <div class="member-cell">
              <div>
                <div style="font-weight: 600;">${entry.member.name}</div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">${entry.member.department || '本社BIM推進部'}</div>
              </div>
            </div>
          </td>
          ${dailyCells}
          <td style="font-weight: 600; color: var(--color-accent);">${formatTimeDisplay(entry.totalMinutes)}</td>
        </tr>
      `;
    }).join('');

  container.innerHTML = weeklyRows;
}

/**
 * 月間レポート詳細画面の描画
 */
async function renderMonthlyReportView() {
  const container = document.getElementById('monthly-report-list');
  if (!container) return;

  const monthlyData = await dataService.getMonthlyUsage();
  const dataToUse = monthlyData;

  const maxHours = Math.max(...dataToUse.map(d => d.hours));

  const items = dataToUse
    .sort((a, b) => b.hours - a.hours)
    .map((entry, i) => {
      const barPercent = Math.round((entry.hours / maxHours) * 100);
      return `
        <div class="ranking-item animate-in delay-${(i % 8) + 1}" style="padding: var(--space-3) var(--space-4);">
          <div class="ranking-position rank-other" style="font-size: var(--text-sm); width: 30px; font-weight: normal; color: var(--color-text-muted);">${i + 1}</div>
          <div class="ranking-info">
            <div>
              <div class="ranking-name">${entry.member.name}</div>
            </div>
          </div>
          <div class="ranking-bar-wrapper" style="flex: 1; margin: 0 var(--space-6);">
            <div class="ranking-bar" style="height: 8px;">
              <div class="ranking-bar-fill rank-other" style="width: ${barPercent}%; background: var(--color-accent-gradient);"></div>
            </div>
          </div>
          <div class="ranking-value" style="font-size: var(--text-base); font-weight: 600;">${formatTimeDisplay(entry.hours * 60)}</div>
        </div>
      `;
    }).join('');

  container.innerHTML = items;
}

/**
 * 設定画面の初期表示
 */
function renderSettingsView() {
  const user = localStorage.getItem('bim_insight_user');
  if (user) {
    const userData = JSON.parse(user);
    const fullnameInput = document.getElementById('settings-fullname');
    const deptSelect = document.getElementById('settings-department');

    if (fullnameInput) fullnameInput.value = userData.fullName;
    if (deptSelect) deptSelect.value = userData.department || userData.organization;
  }

  // 契約ライセンス数の初期値/保存値ロード
  const licensesInput = document.getElementById('settings-licenses');
  if (licensesInput) {
    const savedLicenses = localStorage.getItem('bim_insight_licenses');
    licensesInput.value = savedLicenses ? parseInt(savedLicenses, 10) : 8;
  }
}
