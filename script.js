let detector;
let countA = 0, countB = 0;
let holdCounter = 0;
let currentSelection = null;
let voteChart;

const video = document.getElementById('webcam');
const status = document.getElementById('status');

// 1. グラフの初期化（ここが失敗しても認識が止まらないようにする）
function initChart() {
    try {
        const ctx = document.getElementById('voteChart').getContext('2d');
        voteChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['【A】犬派', '【B】猫派'],
                datasets: [{
                    label: '投票数',
                    data: [0, 0],
                    backgroundColor: ['#4CAF50', '#2196F3']
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    } catch (e) {
        console.error("グラフの初期化に失敗:", e);
    }
}

async function init() {
    try {
        status.innerText = "モデル読み込み中...";
        initChart();
        
        const model = poseDetection.SupportedModels.MoveNet;
        detector = await poseDetection.createDetector(model);
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            status.innerText = "準備完了！手をあげて！";
            detect(); // ループ開始
        };
    } catch (err) {
        status.innerText = "エラー発生: " + err.message;
    }
}

async function detect() {
    try {
        if (!detector) return;

        const poses = await detector.estimatePoses(video);
        let selectionThisFrame = null;

        if (poses && poses.length > 0) {
            const keypoints = poses[0].keypoints;
            
            // 部位を名前で探す（見つからない場合の対策付き）
            const leftWrist = keypoints.find(k => k.name === 'left_wrist');
            const rightWrist = keypoints.find(k => k.name === 'right_wrist');
            const leftShoulder = keypoints.find(k => k.name === 'left_shoulder');
            const rightShoulder = keypoints.find(k => k.name === 'right_shoulder');

            // 判定ロジック：スコア（信頼度）が0.3以上のときだけ判定
            if (leftWrist?.score > 0.3 && leftShoulder?.score > 0.3 && leftWrist.y < leftShoulder.y) {
                selectionThisFrame = 'A';
            } else if (rightWrist?.score > 0.3 && rightShoulder?.score > 0.3 && rightWrist.y < rightShoulder.y) {
                selectionThisFrame = 'B';
            }
        }

        updateLogic(selectionThisFrame);

    } catch (err) {
        console.error("推論ループエラー:", err);
    }
    
    // エラーが起きても次のフレームを実行する
    requestAnimationFrame(detect);
}

function updateLogic(selection) {
    const cardA = document.getElementById('cardA');
    const cardB = document.getElementById('cardB');

    if (selection && selection === currentSelection) {
        holdCounter++;
        status.innerText = `${selection}をホールド中... ${".".repeat(Math.floor(holdCounter/5))}`;
        
        if (holdCounter > 20) { // 判定までの時間を少し短くしてレスポンスを改善
            if (selection === 'A') countA++;
            else countB++;
            
            document.getElementById('count' + selection).innerText = (selection === 'A' ? countA : countB);
            
            if (voteChart) {
                voteChart.data.datasets[0].data = [countA, countB];
                voteChart.update();
            }

            holdCounter = -30; // クールタイム
            status.innerText = "投票完了！";
        }
    } else {
        holdCounter = 0;
        currentSelection = selection;
        if (!selection) status.innerText = "手をあげてください";
    }

    if(cardA) cardA.classList.toggle('active', selection === 'A');
    if(cardB) cardB.classList.toggle('active', selection === 'B');
}

init();