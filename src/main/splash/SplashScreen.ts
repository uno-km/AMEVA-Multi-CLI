import { BrowserWindow } from 'electron'

export class SplashScreen {
  private splashWindow: BrowserWindow | null = null

  create(): BrowserWindow {
    this.splashWindow = new BrowserWindow({
      width: 540,
      height: 350,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      center: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const splashHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card {
      width: 520px;
      height: 330px;
      background: rgba(15, 20, 32, 0.96);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(0, 245, 212, 0.3);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 245, 212, 0.2);
      display: flex;
      flex-direction: column;
      padding: 28px;
      position: relative;
      color: #fff;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #00F5D4, #3A86FF);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 24px rgba(0, 245, 212, 0.6);
    }
    .logo-icon svg {
      width: 34px;
      height: 34px;
      fill: #ffffff;
    }
    .logo-text h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1px;
      background: linear-gradient(90deg, #FFFFFF, #00F5D4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo-text p {
      font-size: 12px;
      color: #8892b0;
      margin-top: 3px;
    }
    .progress-section {
      margin-top: auto;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: #ccd6f6;
      margin-bottom: 8px;
    }
    .percent {
      color: #00F5D4;
      font-family: 'Consolas', 'Fira Code', monospace;
      font-size: 14px;
    }
    .bar-bg {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .bar-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #00F5D4, #38BDF8, #3A86FF);
      border-radius: 999px;
      transition: width 0.25s ease-out;
      box-shadow: 0 0 14px #00F5D4;
    }
    .log-terminal {
      background: rgba(5, 8, 15, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      height: 70px;
      font-family: 'Consolas', 'Fira Code', monospace;
      font-size: 11px;
      color: #8892b0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      overflow: hidden;
    }
    .log-line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.6;
    }
    .log-line.active {
      color: #00F5D4;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24">
          <path d="M12 2L2 19h20L12 2zm0 4.5l6.5 11h-13L12 6.5zM11 10h2v4h-2v-4zm0 5h2v2h-2v-2z"/>
        </svg>
      </div>
      <div class="logo-text">
        <h1>AMEVA Multi-CLI</h1>
        <p>Next-Generation High-Performance Workbench</p>
      </div>
    </div>

    <div class="progress-section">
      <div class="status-row">
        <span id="statusText">초기화 프로세스 시작 중...</span>
        <span id="percentText" class="percent">0%</span>
      </div>
      <div class="bar-bg">
        <div id="barFill" class="bar-fill"></div>
      </div>
      <div class="log-terminal" id="logContainer">
        <div class="log-line active" id="currentLog">[STARTUP] Launching AMEVA Multi-CLI Runtime...</div>
      </div>
    </div>
  </div>

  <script>
    window.updateProgress = (percent, message) => {
      document.getElementById('percentText').innerText = percent + '%';
      document.getElementById('barFill').style.width = percent + '%';
      document.getElementById('statusText').innerText = message;
      
      const logContainer = document.getElementById('logContainer');
      const newLog = document.createElement('div');
      newLog.className = 'log-line active';
      newLog.innerText = '> ' + message;
      
      const lines = logContainer.getElementsByClassName('log-line');
      for(let i=0; i<lines.length; i++) {
        lines[i].classList.remove('active');
        lines[i].style.opacity = '0.5';
      }
      
      logContainer.appendChild(newLog);
      if (logContainer.children.length > 3) {
        logContainer.removeChild(logContainer.firstChild);
      }
    };
  </script>
</body>
</html>
    `

    this.splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

    this.splashWindow.once('ready-to-show', () => {
      this.splashWindow?.show()
    })

    return this.splashWindow
  }

  updateProgress(percent: number, message: string): void {
    if (!this.splashWindow || this.splashWindow.isDestroyed()) return
    const safeMsg = message.replace(/'/g, "\\'")
    this.splashWindow.webContents.executeJavaScript(
      `window.updateProgress && window.updateProgress(${percent}, '${safeMsg}')`
    ).catch(() => {})
  }

  close(): void {
    if (!this.splashWindow || this.splashWindow.isDestroyed()) return
    this.splashWindow.close()
    this.splashWindow = null
  }
}
