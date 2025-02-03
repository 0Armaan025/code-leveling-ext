import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let timerStartTime: number | undefined;
let timerInterval: NodeJS.Timeout | undefined;
let timeSpent: number = 0;
let currentLanguage: string = '';
let totalTimeSpent: number = 0;
let startDate: string = '';
let projectName: string = '';
let projectStats: { [key: string]: number } = {};

// Path to the AppData/Roaming folder
const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code-leveling'); // Replace 'YourAppName' with your application name or project name
const timeTrackerFilePath = path.join(appDataPath, 'timeTracker.json');

// Ensure the directory exists
fs.mkdirSync(appDataPath, { recursive: true });

// Function to start tracking time
function startTrackingTime() {
  if (timerStartTime !== undefined) {
    return; // Timer is already running
  }
  timerStartTime = Date.now();
  startDate = new Date().toISOString().split('T')[0]; // Store the date in YYYY-MM-DD format
  if (!projectName) {
    projectName = vscode.workspace.name || 'Unknown Project';
  }

  // Update the timer every second
  timerInterval = setInterval(() => {
    if (timerStartTime) {
      timeSpent = Date.now() - timerStartTime;

      // Add time to the current language's timeSpent
      if (currentLanguage) {
        projectStats[currentLanguage] = (projectStats[currentLanguage] || 0) + 1000; // Add 1 second every time interval
      }

      // Calculate total time spent across all languages
      totalTimeSpent = Object.values(projectStats).reduce((acc, time) => acc + time, 0);

      updateStatusBarItem();
    }
  }, 1000); // Update every second

  // Call "Hi" function every 7 minutes (420,000 milliseconds)
  setInterval(sayHi, 7 * 60 * 1000); // 7 minutes
}

// Function that says "Hi"
function sayHi() {
  vscode.window.showInformationMessage('Hi');
}

// Function to stop tracking time
function stopTrackingTime() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }
  if (timerStartTime) {
    timeSpent = Date.now() - timerStartTime;
    if (currentLanguage) {
      projectStats[currentLanguage] = (projectStats[currentLanguage] || 0) + timeSpent;
    }
    totalTimeSpent = Object.values(projectStats).reduce((acc, time) => acc + time, 0);
    timerStartTime = undefined;
    saveTimeTrackingData();
    updateStatusBarItem();
    // Prevent multiple notifications
    vscode.window.showInformationMessage(`Stopped tracking time for ${currentLanguage}. Time spent: ${timeSpent / 1000}s`);
  }
}

// Function to save the time tracking data to a file
function saveTimeTrackingData() {
  const data = {
    currentLanguage,
    timeSpent: projectStats[currentLanguage] || 0,
    totalTimeSpent,
    startDate,
    projectName,
    projectStats,
  };

  fs.writeFile(timeTrackerFilePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      vscode.window.showErrorMessage('Error saving time tracking data: ' + err.message);
    }
  });
}

// Function to load existing time tracking data
function loadTimeTrackingData() {
  fs.readFile(timeTrackerFilePath, 'utf8', (err, data) => {
    if (err) {
      return; 
    }
    try {
      const parsedData = JSON.parse(data);
      if (parsedData.projectStats) {
        projectStats = parsedData.projectStats;
        if (parsedData.projectName && parsedData.startDate) {
          projectName = parsedData.projectName;
          startDate = parsedData.startDate;
        }
        if (parsedData.totalTimeSpent) {
          totalTimeSpent = parsedData.totalTimeSpent;
        }
      }
    } catch (e: any) {
      vscode.window.showErrorMessage('Error parsing time tracking data: ' + e.message);
    }
  });
}

// Function to track the language change and stop/start the timer when switching files
function onEditorChange() {
  const newLanguage = vscode.window.activeTextEditor?.document.languageId;
  if (newLanguage && newLanguage !== currentLanguage) {
    currentLanguage = newLanguage;
    stopTrackingTime();  // Stop previous language timer
    startTrackingTime(); // Start new language timer
    vscode.window.showInformationMessage(`Now tracking ${newLanguage}`);
  }
}

let statusBarItem: vscode.StatusBarItem;
function updateStatusBarItem() {
  if (statusBarItem) {
    const totalTimeInMinutes = Math.floor(totalTimeSpent / 1000 / 60);
    const hours = Math.floor(totalTimeInMinutes / 60);
    const minutes = totalTimeInMinutes % 60;

    statusBarItem.text = `Time: ${hours}h ${minutes}m`;
    statusBarItem.show();
  }
}

// Handle status bar click
function handleStatusBarClick() {
  vscode.window.showInputBox({ prompt: 'Enter your API Key' }).then((apiKey) => {
    if (apiKey) {
      vscode.window.showInformationMessage(`API Key entered: ${apiKey}`);
    } else {
      vscode.window.showInformationMessage('API Key not entered');
    }
  });
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('Your time-tracking extension is now active!');
  loadTimeTrackingData();

  // Create the status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'extension.handleStatusBarClick'; // Assigning a command for status bar click
  context.subscriptions.push(statusBarItem);

  // Register command to start tracking time
  const startCommand = vscode.commands.registerCommand('code-leveling.start', () => {
    const language = vscode.window.activeTextEditor?.document.languageId;
    if (language) {
      currentLanguage = language;
      startTrackingTime();
      vscode.window.showInformationMessage(`Started tracking time for ${language}`);
    } else {
      vscode.window.showInformationMessage('No active document found!');
    }
  });

  // Register command to stop tracking time
  const stopCommand = vscode.commands.registerCommand('code-leveling.stop', () => {
    stopTrackingTime();
    vscode.window.showInformationMessage(`Stopped tracking time for ${currentLanguage}. Time spent: ${timeSpent / 1000}s`);
  });

  // Register command to show the tracked time for the current language
  const showCommand = vscode.commands.registerCommand('code-leveling.showTime', () => {
    vscode.window.showInformationMessage(`Time spent on ${currentLanguage}: ${projectStats[currentLanguage] / 1000}s`);
  });

  // Register command to show project stats (total time and language-specific times)
  const showProjectStats = vscode.commands.registerCommand('code-leveling.showProjectStats', () => {
    let statsMessage = `Project: ${projectName}\nTotal time spent: ${totalTimeSpent / 1000}s\nLanguages:\n`;
    for (const [language, time] of Object.entries(projectStats)) {
      statsMessage += `${language}: ${time / 1000}s\n`;
    }
    vscode.window.showInformationMessage(statsMessage);
  });

  // Handle editor change events to track language
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(onEditorChange);

  // Status bar click disposable
  const statusBarClickDisposable = vscode.commands.registerCommand('extension.handleStatusBarClick', handleStatusBarClick);
  context.subscriptions.push(startCommand, stopCommand, showCommand, showProjectStats, editorChangeDisposable, statusBarClickDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
}
