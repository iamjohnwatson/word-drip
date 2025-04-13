// Letter frequency distribution based on English language frequency - adjusted vowel frequencies
const LETTER_FREQUENCIES = {
  'A': 6.5, 'B': 1.8, 'C': 3.0, 'D': 4.5, 'E': 9.8, 'I': 5.8, 'O': 6.0, 'U': 2.3,
  'F': 2.4, 'G': 2.2, 'H': 6.3, 'J': 0.2, 'K': 0.9, 'L': 4.2, 'M': 2.6,
  'N': 7.0, 'P': 2.0, 'Q': 0.1, 'R': 6.3, 'S': 6.5, 'T': 9.5, 'V': 1.1,
  'W': 2.6, 'X': 0.2, 'Y': 2.2, 'Z': 0.1
};

// Sound effects
const successSound = new Audio('sounds/success.mp3');
const errorSound = new Audio('sounds/error.mp3');
const completeSound = new Audio('sounds/complete.mp3');

let grid = [];
let usedWords = new Set();
let score = 0;
let gameStarted = false;
let timer;
let timeLeft = 180; // 3 minutes
let wordSet = new Set();
const vowels = ['A', 'E', 'I', 'O', 'U'];
// Streak variables
let currentStreak = 0;
let lastPlayDate = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch("words.json")
    .then(res => res.json())
    .then(data => {
      wordSet = new Set(data.words.map(w => w.toLowerCase()));
      console.log("Dictionary loaded:", wordSet.size, "words");
      initGrid();
      loadStreak();
    })
    .catch(err => {
      console.error("Error loading words.json:", err);
      initGrid();
      loadStreak();
    });

  document.getElementById('wordForm').addEventListener('submit', handleWordSubmit);
  document.getElementById('newGameBtn').addEventListener('click', startNewGame);
  document.getElementById('infoBtn').addEventListener('click', toggleRules);
  document.getElementById('shareBtn').addEventListener('click', toggleShare);
  
  // Add event listeners for share buttons
  document.getElementById('twitterShare').addEventListener('click', shareToTwitter);
  document.getElementById('facebookShare').addEventListener('click', shareToFacebook);
  document.getElementById('whatsappShare').addEventListener('click', shareToWhatsApp);
  document.getElementById('copyLink').addEventListener('click', copyShareLink);
});

function loadStreak() {
  // Load streak data from localStorage
  currentStreak = parseInt(localStorage.getItem('wordDripStreak') || '0');
  lastPlayDate = localStorage.getItem('wordDripLastPlayed');
  
  // Check if this is a new day
  const today = new Date().toLocaleDateString();
  
  if (lastPlayDate) {
    if (lastPlayDate === today) {
      // Already played today
      updateStreakDisplay();
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString();
      
      if (lastPlayDate === yesterdayStr) {
        // Played yesterday, continue streak
        currentStreak += 1;
      } else {
        // Missed a day, reset streak
        currentStreak = 1;
      }
      
      // Update last played date
      lastPlayDate = today;
      saveStreakData();
    }
  } else {
    // First time playing
    currentStreak = 1;
    lastPlayDate = today;
    saveStreakData();
  }
  
  updateStreakDisplay();
}

function saveStreakData() {
  localStorage.setItem('wordDripStreak', currentStreak.toString());
  localStorage.setItem('wordDripLastPlayed', lastPlayDate);
}

function updateStreakDisplay() {
  const streakElement = document.getElementById('streak');
  if (streakElement) {
    streakElement.textContent = currentStreak;
    
    // Add animation if streak is at certain milestones
    if (currentStreak >= 5) {
      streakElement.classList.add('milestone');
    }
    if (currentStreak >= 10) {
      streakElement.classList.add('fire');
    }
  }
}

function getWeightedRandomLetter() {
  // Create distribution array based on frequencies
  let distribution = [];
  for (let letter in LETTER_FREQUENCIES) {
    // Push each letter multiple times according to its frequency
    const count = Math.round(LETTER_FREQUENCIES[letter] * 10);
    for (let i = 0; i < count; i++) {
      distribution.push(letter);
    }
  }
  
  // Pick a random letter from the distribution
  return distribution[Math.floor(Math.random() * distribution.length)];
}

function balancedLetterSelection() {
  const currentGrid = [...grid];
  
  // Count current letters in grid
  const letterCount = {};
  for (let letter of currentGrid) {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  }
  
  // Ensure we have at least some vowels
  let vowelCount = vowels.reduce((count, vowel) => count + (letterCount[vowel] || 0), 0);
  const totalLetters = currentGrid.length;
  
  // Aim for about 30-35% vowels (reduced from 35-40%)
  if (vowelCount / (totalLetters + 1) < 0.30) {
    return vowels[Math.floor(Math.random() * vowels.length)];
  }
  
  // Make it harder to get vowels if we already have enough
  if (vowelCount / (totalLetters + 1) >= 0.35) {
    // Only consonants
    let letter;
    do {
      letter = getWeightedRandomLetter();
    } while (vowels.includes(letter));
    return letter;
  }
  
  // Avoid letters that already appear too frequently
  let letter;
  let attempts = 0;
  do {
    letter = getWeightedRandomLetter();
    attempts++;
    // If a letter already appears 3 or more times, try to get a different one
    // But don't try forever - after 10 attempts just use what we have
  } while (attempts < 10 && (letterCount[letter] || 0) >= 3);
  
  return letter;
}

function initGrid() {
  grid = [];
  // Generate 7 balanced initial letters
  while (grid.length < 7) {
    grid.push(balancedLetterSelection());
  }
  
  // Ensure we have at least 2 vowels
  let vowelCount = grid.filter(l => vowels.includes(l)).length;
  while (vowelCount < 2) {
    let replaceIdx = Math.floor(Math.random() * 7);
    grid[replaceIdx] = vowels[Math.floor(Math.random() * vowels.length)];
    vowelCount = grid.filter(l => vowels.includes(l)).length;
  }
  
  updateGridDisplay();
  console.log("Initial letters:", grid);
}

function updateGridDisplay() {
  const gridDiv = document.getElementById('grid');
  gridDiv.innerHTML = '';
  
  // Create rows for every 7 letters
  for (let i = 0; i < Math.min(Math.ceil(grid.length / 7), 3); i++) {
    const rowDiv = document.createElement('div');
    rowDiv.classList.add('letter-row');
    
    // Add letters for this row
    for (let j = 0; j < 7; j++) {
      const idx = i * 7 + j;
      if (idx < grid.length) {
        const div = document.createElement('div');
        div.classList.add('tile');
        div.textContent = grid[idx];
        div.dataset.index = idx;
        
        // Add dripping animation class
        div.classList.add('dripping');
        
        // Add new tile animation for newly added letters
        if (gameStarted && idx >= grid.length - 7) {
          div.classList.add('new-tile');
        }
        
        rowDiv.appendChild(div);
      }
    }
    
    gridDiv.appendChild(rowDiv);
  }
  
  console.log("Updated grid:", grid);
}

function formatTime(t) {
  const m = String(Math.floor(t / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = formatTime(timeLeft);

    // Add new letter every 10 seconds
    if (timeLeft % 10 === 0 && grid.length < 21) {
      const newChar = balancedLetterSelection();
      grid.push(newChar);
      updateGridDisplay();
    }

    if (usedWords.size >= 15) {
      clearInterval(timer);
      showFeedback("🎉 Congratulations! You have reached the target of 15 words.", true);
      completeSound.play();
      document.getElementById('wordInput').disabled = true;
      document.querySelector('button[type="submit"]').disabled = true;
      document.getElementById('shareScore').textContent = score;
      return;
    }

    if (timeLeft <= 0) {
      clearInterval(timer);
      showFeedback("⏰ Time up, game over!", false);
      errorSound.play();
      currentStreak = 1;
      saveStreakData();
      updateStreakDisplay();
      document.getElementById('wordInput').disabled = true;
      document.querySelector('button[type="submit"]').disabled = true;
      document.getElementById('shareScore').textContent = score;
    }
  }, 1000);
}

function handleWordSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('wordInput');
  const word = input.value.toUpperCase().trim();
  input.value = '';
  if (!word) return;

  console.log("Validating word:", word);

  if (word.length < 3) {
    showFeedback("Words must be at least 3 letters!", false);
    return;
  }

  if (!isWordFromGrid(word)) {
    showFeedback("Letters not on grid!", false);
    return;
  }

  if (!wordSet.has(word.toLowerCase())) {
    showFeedback("Not a valid word!", false);
    return;
  }

  if (usedWords.has(word)) {
    showFeedback("Already used!", false);
    return;
  }

  usedWords.add(word);
  applyScore(word);
  removeLetters(word);
  if (grid.length <= 3) refillGrid();
  updateGridDisplay();
  showFeedback("✓ " + word + " accepted!", true);

  if (!gameStarted) {
    gameStarted = true;
    startTimer();
  }

  const wordBox = document.createElement('div');
  wordBox.className = 'accepted-word';
  wordBox.textContent = word;
  document.getElementById('wordList').appendChild(wordBox);
  
  // Update share score
  document.getElementById('shareScore').textContent = score;
}

function showFeedback(msg, success) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.style.color = success ? '#00ff99' : '#ff6666';
  if (success) {
    successSound.play();
  } else {
    errorSound.play();
  }
}

function applyScore(word) {
  // Updated scoring system
  let points = 0;
  if (word.length === 3) {
    points = 3;
  } else if (word.length === 4) {
    points = 4;
  } else if (word.length === 5) {
    points = 10;
  } else if (word.length >= 6) {
    points = 15;
  }
  
  score += points;
  document.getElementById('score').textContent = score;
}

function isWordFromGrid(word) {
  let temp = [...grid];
  for (let letter of word) {
    const idx = temp.indexOf(letter);
    if (idx === -1) return false;
    temp[idx] = null;
  }
  return true;
}

function removeLetters(word) {
  let tempGrid = [...grid];
  word.split('').forEach(letter => {
    const idx = tempGrid.indexOf(letter);
    if (idx !== -1) {
      const rowIndex = Math.floor(idx / 7);
      const colIndex = idx % 7;
      const tile = document.querySelector(`.letter-row:nth-child(${rowIndex + 1}) .tile:nth-child(${colIndex + 1})`);
      
      if (tile) {
        tile.classList.add('used');
        tile.classList.remove('dripping');
        tile.animate([
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(2)', opacity: 0 }
        ], {
          duration: 500,
          easing: 'ease-out'
        });
      }
      tempGrid[idx] = null;
    }
  });
  
  // Filter out removed letters
  grid = tempGrid.filter(x => x !== null);
  
  // Update grid after animation completes
  setTimeout(() => updateGridDisplay(), 500);
}

function refillGrid() {
  console.log("Refilling to 7 letters...");
  while (grid.length < 7) {
    grid.push(balancedLetterSelection());
  }
  updateGridDisplay();
}

function startNewGame() {
  // Reset game state
  grid = [];
  usedWords = new Set();
  score = 0;
  gameStarted = false;
  timeLeft = 300;
  
  // Clear UI
  document.getElementById('score').textContent = '0';
  document.getElementById('timer').textContent = '05:00';
  document.getElementById('wordList').innerHTML = '';
  document.getElementById('feedback').textContent = '';
  document.getElementById('shareScore').textContent = '0';
  
  // Enable inputs
  document.getElementById('wordInput').disabled = false;
  document.querySelector('button[type="submit"]').disabled = false;
  
  // Clear any existing timer
  if (timer) {
    clearInterval(timer);
  }
  
  // Update streak if it's a new day
  const today = new Date().toLocaleDateString();
  if (lastPlayDate !== today) {
    // Set today as the last played date
    lastPlayDate = today;
    currentStreak += 1;
    saveStreakData();
    updateStreakDisplay();
  }
  
  // Initialize grid
  initGrid();
}

function toggleRules() {
  const rulesPanel = document.getElementById('rulesPanel');
  rulesPanel.classList.toggle('show-rules');
}

function toggleShare() {
  const sharePanel = document.getElementById('sharePanel');
  sharePanel.classList.toggle('show-share');
  document.getElementById('shareScore').textContent = score;
}

function shareToTwitter() {
  const text = `I scored ${score} points in Word Drip! Day ${currentStreak} streak! Can you beat my score?`;
  const url = window.location.href;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function shareToFacebook() {
  const url = window.location.href;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
}

function shareToWhatsApp() {
  const text = `I scored ${score} points in Word Drip! Day ${currentStreak} streak! Can you beat my score?`;
  const url = window.location.href;
  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
}

function copyShareLink() {
  const text = `I scored ${score} points in Word Drip! Day ${currentStreak} streak! Can you beat my score? ${window.location.href}`;
  
  navigator.clipboard.writeText(text)
    .then(() => {
      const copyBtn = document.getElementById('copyLink');
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
}
