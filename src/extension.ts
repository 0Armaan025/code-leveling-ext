import * as vscode from 'vscode';
import * as path from 'path';

let timerStartTime: number | undefined;
let timerInterval: NodeJS.Timeout | undefined;
let statsInterval: NodeJS.Timeout | undefined; // New interval for showing stats
let projectName: string = '';
let projectStats: { 
  [key: string]: { 
    [date: string]: { totalTime: number, fileStats: { [key: string]: number } } 
  } 
} = {};
let lastActivityTime: number = Date.now();

let statusBarItem: vscode.StatusBarItem;

// Function to get the current date in "YYYY-MM-DD (Day)" format
function getCurrentDate(): string {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${now.toISOString().split('T')[0]} (${dayNames[now.getDay()]})`;
}

// Function to start tracking time
function startTrackingTime(context: vscode.ExtensionContext) {
  projectStats = context.globalState.get('projectStats', {}) || {}; 

  if (timerStartTime !== undefined) return; // Already tracking

  timerStartTime = Date.now();
  projectName = vscode.workspace.workspaceFolders?.[0]?.name || 'Unknown Project';
  const currentDate = getCurrentDate();

  if (!projectStats[projectName]) projectStats[projectName] = {};
  if (!projectStats[projectName][currentDate]) {
    projectStats[projectName][currentDate] = { totalTime: 0, fileStats: {} };
  }

  timerInterval = setInterval(() => {
    if (Date.now() - lastActivityTime > 30000) return; // Ignore if idle for 30 seconds

    projectStats[projectName][currentDate].totalTime += 1000;

    const fileExt = path.extname(vscode.window.activeTextEditor?.document.fileName || '');
    if (fileExt) {
      projectStats[projectName][currentDate].fileStats[fileExt] = 
        (projectStats[projectName][currentDate].fileStats[fileExt] || 0) + 1000;
    }

    context.globalState.update('projectStats', projectStats);
    updateStatusBarItem();
  }, 1000);

  // Show stats every 7 minutes (7 * 60 * 1000 ms)
  statsInterval = setInterval(() => {
    showProjectStats(context);
  }, 15 * 60 * 1000);

  vscode.window.showInformationMessage('Tracking started');
}

// Function to stop tracking time
function stopTrackingTime() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = undefined;
  }
  timerStartTime = undefined;
  vscode.window.showInformationMessage('Tracking stopped');
}

// Function to detect user activity
function onUserActivity() {
  lastActivityTime = Date.now();
}

// Function to update the status bar
function updateStatusBarItem() {
  if (statusBarItem && projectStats[projectName]) {
    const currentDate = getCurrentDate();
    const totalTime = projectStats[projectName][currentDate]?.totalTime || 0;
    const minutes = Math.floor(totalTime / 1000 / 60);
    statusBarItem.text = `⏳ ${minutes} min today`;
    statusBarItem.show();
  }
}

// Function to show tracked stats for the current project
function showProjectStats(context: vscode.ExtensionContext) {
  projectStats = context.globalState.get('projectStats', {}) || {}; 

  if (!projectName || !projectStats[projectName]) {
    vscode.window.showInformationMessage('No stats available.');
    return;
  }

  const stats = projectStats[projectName];
  const currentDate = getCurrentDate();
  const data = stats[currentDate];

  if (!data) {
    vscode.window.showInformationMessage('No tracked time today.');
    return;
  }

  let statsMessage = `📊 **Project: ${projectName}**\n📅 **${currentDate}**\n🕒 Total: ${(data.totalTime / 1000 / 60).toFixed(1)} min\n`;

  const fileEntries = Object.entries(data.fileStats)
    .map(([ext, time]) => `- ${ext}: ${(time / 1000 / 60).toFixed(1)} min`)
    .join("\n");

  statsMessage += fileEntries || "📂 No tracked files";

  vscode.window.showInformationMessage(statsMessage);
}

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('Time Tracker extension activated');

  projectStats = context.globalState.get('projectStats', {}) || {};

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'code-leveling.showStats';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  const startCommand = vscode.commands.registerCommand('code-leveling.start', () => startTrackingTime(context));
  const stopCommand = vscode.commands.registerCommand('code-leveling.stop', stopTrackingTime);
  const showStatsCommand = vscode.commands.registerCommand('code-leveling.showStats', () => showProjectStats(context));

  context.subscriptions.push(startCommand, stopCommand, showStatsCommand);

  updateStatusBarItem();

  vscode.workspace.onDidChangeTextDocument(onUserActivity);
  vscode.window.onDidChangeActiveTextEditor(onUserActivity);
  vscode.window.onDidChangeWindowState((e) => { if (e.focused) onUserActivity(); });
}

// This method is called when the extension is deactivated
export function deactivate() {
  stopTrackingTime();
}
