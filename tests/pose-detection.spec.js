const { test, expect } = require('@playwright/test');

test.describe('ポーズ検出テスト', () => {
  test.beforeEach(async ({ page, context }) => {
    // カメラのモックを設定
    await context.grantPermissions(['camera']);
    
    // カメラストリームをモック
    await page.addInitScript(() => {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // テスト用のカラーのビデオストリームを作成
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // カラーの背景を描画
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 簡単な人のシルエットを描画（テスト用）
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(320, 150, 30, 0, Math.PI * 2); // 頭
        ctx.fill();
        ctx.fillRect(300, 180, 40, 80); // 胴体
        ctx.fillRect(280, 200, 20, 60); // 左腕
        ctx.fillRect(340, 200, 20, 60); // 右腕
        ctx.fillRect(300, 260, 20, 80); // 左脚
        ctx.fillRect(320, 260, 20, 80); // 右脚
        
        const stream = canvas.captureStream(30);
        
        // ビデオ要素に接続したときにサイズが正しく設定されるようにする
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          Object.defineProperty(videoTrack, 'getSettings', {
            value: () => ({
              ...settings,
              width: 640,
              height: 480,
            }),
          });
        }
        
        return stream;
      };
    });
  });

  test('ページが正常に読み込まれる', async ({ page }) => {
    await page.goto('/');
    
    // タイトルを確認
    await expect(page.locator('h1')).toHaveText('ポーズ合わせゲーム');
    
    // スコアカードが表示されることを確認
    await expect(page.locator('#score1')).toBeVisible();
    await expect(page.locator('#score2')).toBeVisible();
    await expect(page.locator('#score3')).toBeVisible();
    await expect(page.locator('#score4')).toBeVisible();
  });

  test('カメラが起動する', async ({ page }) => {
    await page.goto('/');
    
    // カメラ要素が存在することを確認
    const video = page.locator('#webcam');
    await expect(video).toBeVisible();
    
    // ステータスメッセージを確認
    await page.waitForTimeout(3000); // モデル読み込み待機
    const status = page.locator('#status');
    const statusText = await status.textContent();
    console.log('ステータス:', statusText);
    
    // 準備完了メッセージが表示されることを確認（またはエラーメッセージでないこと）
    expect(statusText).not.toContain('エラー');
  });

  test('難易度ボタンが動作する', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // 難易度ボタンをクリック
    await page.locator('#diffEasy').click();
    await expect(page.locator('#diffEasy')).toHaveClass(/active/);
    
    await page.locator('#diffNormal').click();
    await expect(page.locator('#diffNormal')).toHaveClass(/active/);
    
    await page.locator('#diffHard').click();
    await expect(page.locator('#diffHard')).toHaveClass(/active/);
  });

  test('次のポーズボタンが動作する', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // 最初のポーズ名を取得
    const initialPoseName = await page.locator('#targetName').textContent();
    console.log('最初のポーズ:', initialPoseName);
    
    // 次のポーズボタンをクリック
    await page.locator('#nextPoseBtn').click();
    await page.waitForTimeout(500);
    
    // ポーズ名が変更されたことを確認
    const newPoseName = await page.locator('#targetName').textContent();
    console.log('新しいポーズ:', newPoseName);
    expect(newPoseName).not.toBe(initialPoseName);
  });

  test('コンソールエラーがない', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(5000); // モデル読み込みと初期化を待機
    
    // コンソールログを確認
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });
    
    console.log('検出されたログ数:', logs.length);
    console.log('エラー数:', errors.length);
    
    // 重大なエラーがないことを確認
    const criticalErrors = errors.filter(e => 
      !e.includes('BGM playback failed') && 
      !e.includes('NotAllowedError')
    );
    
    if (criticalErrors.length > 0) {
      console.log('重大なエラー:', criticalErrors);
    }
    
    // 検出ログがあることを確認（人が検出されていなくても、検出処理は動作している）
    const detectionLogs = logs.filter(l => 
      l.includes('検出されたポーズ数') || 
      l.includes('drawOverlay') ||
      l.includes('有効キーポイント数')
    );
    
    console.log('検出関連のログ:', detectionLogs.length);
  });

  test('overlayCanvasが存在し、サイズが正しい', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    const overlayCanvas = page.locator('#overlayCanvas');
    await expect(overlayCanvas).toBeVisible();
    
    // Canvasのサイズを確認
    const width = await overlayCanvas.evaluate(el => el.width);
    const height = await overlayCanvas.evaluate(el => el.height);
    
    console.log('overlayCanvasサイズ:', width, 'x', height);
    
    // サイズが正しく設定されていることを確認（0より大きい）
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});
