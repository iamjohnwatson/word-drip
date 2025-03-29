document.addEventListener("DOMContentLoaded", async function () {
    // DOM Elements
    const wordChainContainer = document.getElementById("word-chain");
    const wordInput = document.getElementById("word-input");
    const submitButton = document.getElementById("submit-word");
    const hintButtons = document.querySelectorAll(".hint-button");
    const hintDisplay = document.getElementById("hint-display");
    const scoreDisplay = document.getElementById("score");
    const startWordDisplay = document.getElementById("start-word");
    const completionMessage = document.getElementById("completion-message");
    const errorMessage = document.getElementById("error-message");
    const progressBar = document.getElementById("progress-bar");
    const difficultySelector = document.getElementById("difficulty");
    const soundToggle = document.getElementById("sound-toggle");
    const definitionModal = document.getElementById("definition-modal");
    const modalWord = document.getElementById("modal-word");
    const modalBody = document.getElementById("modal-body");
    const closeModal = document.getElementById("close-modal");
    const leaderboardButton = document.getElementById("leaderboard-button");
    const leaderboardModal = document.getElementById("leaderboard-modal");
    const closeLeaderboard = document.getElementById("close-leaderboard");
    const tabButtons = document.querySelectorAll(".tab-button");
    const leaderboardContent = document.getElementById("leaderboard-content");
    const dailyStreakDisplay = document.getElementById("daily-streak");
    const connectionSvg = document.getElementById("connection-svg");

    // Game variables
    let wordChain = [];
    let score = 0;
    let streak = 0;
    let targetWord = "";
    let usedHint = false;
    let lastHintLevel = 0;
    const targetChainLength = 10;
    let soundEnabled = localStorage.getItem("soundEnabled") !== "false";
    let gameStartTime = 0;
    let dailyStreak = parseInt(localStorage.getItem("dailyStreak") || "0");
    let lastPlayDate = localStorage.getItem("lastPlayDate");
    
    // Audio effects
    const audioEffects = {
        success: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3"),
        error: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-negative-guitar-tone-2324.mp3"),
        complete: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3"),
        hint: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-game-click-1114.mp3")
    };
    
    // Adjust audio volumes
    Object.values(audioEffects).forEach(audio => {
        audio.volume = 0.4;
    });
    
    // Cache system
    let wordRelationCache = {};
    
    // Initialize IndexedDB
    let db;
    const request = indexedDB.open("WordChainDB", 2);
    
    request.onupgradeneeded = function(event) {
        db = event.target.result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains("wordRelations")) {
            db.createObjectStore("wordRelations", { keyPath: "word" });
        }
        
        if (!db.objectStoreNames.contains("leaderboard")) {
            const leaderboardStore = db.createObjectStore("leaderboard", { keyPath: "id", autoIncrement: true });
            leaderboardStore.createIndex("score", "score");
            leaderboardStore.createIndex("date", "date");
        }
        
        if (!db.objectStoreNames.contains("gameStats")) {
            db.createObjectStore("gameStats", { keyPath: "key" });
        }
    };
    
    request.onsuccess = function(event) {
        db = event.target.result;
        checkDailyStreak();
        initializeGame();
        updateLeaderboardUI("daily");
    };
    
    request.onerror = function(event) {
        console.error("IndexedDB error:", event.target.error);
        // Proceed without IndexedDB
        initializeGame();
    };

    // Check and update daily streak
    function checkDailyStreak() {
        const today = new Date().toISOString().split('T')[0];
        
        if (lastPlayDate) {
            const lastDate = new Date(lastPlayDate);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastPlayDate === today) {
                // Already played today
            } else if (lastPlayDate === yesterday.toISOString().split('T')[0]) {
                // Played yesterday, increment streak
                dailyStreak++;
                localStorage.setItem("dailyStreak", dailyStreak);
            } else {
                // Missed a day, reset streak
                dailyStreak = 1;
                localStorage.setItem("dailyStreak", dailyStreak);
            }
        } else {
            // First time playing
            dailyStreak = 1;
            localStorage.setItem("dailyStreak", dailyStreak);
        }
        
        localStorage.setItem("lastPlayDate", today);
        updateDailyStreakDisplay();
    }
    
    function updateDailyStreakDisplay() {
        dailyStreakDisplay.textContent = `Daily Streak: ${dailyStreak}`;
        if (dailyStreak >= 3) {
            dailyStreakDisplay.parentElement.classList.add("active");
        } else {
            dailyStreakDisplay.parentElement.classList.remove("active");
        }
    }

    // Get random word with difficulty factor
    async function getRandomEnglishWord(difficulty = "medium") {
        const difficultyValue = difficultySelector.value || difficulty;
        
        const seedWords = {
            easy: ["dog", "cat", "house", "food", "car", "book", "tree", "friend", "light", "water"],
            medium: ["science", "journey", "system", "creative", "project", "ocean", "mountain", "computer", "festival", "architect"],
            hard: ["quantum", "philosophy", "abstract", "paradox", "theorem", "algorithm", "consciousness", "perspective", "renaissance", "paradigm"],
            wild: ["serendipity", "ephemeral", "labyrinth", "zeitgeist", "quintessence", "juxtaposition", "metamorphosis", "ethereal", "phenomenology", "mellifluous"]
        };
        
        try {
            // Try to get from API
            const startWord = seedWords[difficultyValue][Math.floor(Math.random() * seedWords[difficultyValue].length)];
                
            const response = await fetch(`https://api.conceptnet.io/query?start=/c/en/${encodeURIComponent(startWord)}&rel=/r/RelatedTo&limit=20`);
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            const words = data.edges
                .map(edge => edge.end.term.split('/').pop().toLowerCase())
                .filter(label => /^[a-zA-Z]+$/.test(label) && label.length > 3); 
            
            return words.length > 0 ? words[Math.floor(Math.random() * words.length)] : startWord;
        } catch (error) {
            console.error("Error fetching word:", error);
            // Fallback to predefined word
            return seedWords[difficultyValue][Math.floor(Math.random() * seedWords[difficultyValue].length)];
        }
    }

    // Get target word that's distantly related to start word
    async function getTargetWord(startWord, difficulty = "medium") {
        const difficultyValue = difficultySelector.value || difficulty;
        
        try {
            // Get a word that's N hops away based on difficulty
            const hops = difficultyValue === "easy" ? 1 : 
                        (difficultyValue === "medium" ? 2 : 
                        (difficultyValue === "hard" ? 3 : 4)); // 4 for wild
            
            let currentWord = startWord;
            let visitedWords = new Set([startWord]);
            
            for (let i = 0; i < hops; i++) {
                const relatedWords = await getRelatedEnglishWords(currentWord, 20);
                const filteredWords = relatedWords.filter(word => 
                    !visitedWords.has(word) && 
                    word.length >= 4 && 
                    !/^[A-Z]/.test(word)
                );
                
                if (filteredWords.length > 0) {
                    currentWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
                    visitedWords.add(currentWord);
                } else if (relatedWords.length > 0) {
                    // If no new words, just pick any related word
                    currentWord = relatedWords[Math.floor(Math.random() * relatedWords.length)];
                }
            }
            
            return currentWord !== startWord ? currentWord : await getRandomEnglishWord(difficulty);
        } catch (error) {
            console.error("Error getting target word:", error);
            return await getRandomEnglishWord(difficulty);
        }
    }

    // Get related words with caching
    async function getRelatedEnglishWords(word, limit = 10) {
        // Check cache first
        if (wordRelationCache[word]) {
            return wordRelationCache[word];
        }
        
        // Check IndexedDB
        const dbResult = await checkIndexedDB(word);
        if (dbResult && dbResult.relations) {
            wordRelationCache[word] = dbResult.relations;
            return dbResult.relations;
        }
        
        // Fetch from API
        try {
            const response = await fetch(`https://api.conceptnet.io/query?start=/c/en/${encodeURIComponent(word)}&rel=/r/RelatedTo&limit=${limit}`);
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            const relatedWords = data.edges
                .map(edge => edge.end.term.split('/').pop().toLowerCase()) 
                .filter(label => /^[a-zA-Z]+$/.test(label) && !wordChain.includes(label));
            
            // Cache the results
            wordRelationCache[word] = relatedWords;
            saveToIndexedDB(word, relatedWords);
            
            return relatedWords;
        } catch (error) {
            console.error("Error fetching related words:", error);
            return [];
        }
    }
    
    // Fetch word definition
    async function getWordDefinition(word) {
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            if (!response.ok) throw new Error('Definition not found');
            
            const data = await response.json();
            return data[0];
        } catch (error) {
            console.error("Error fetching definition:", error);
            return null;
        }
    }
    
    // IndexedDB functions
    function checkIndexedDB(word) {
        return new Promise((resolve, reject) => {
            if (!db) {
                resolve(null);
                return;
            }
            
            const transaction = db.transaction(["wordRelations"], "readonly");
            const store = transaction.objectStore("wordRelations");
            const request = store.get(word);
            
            request.onsuccess = function() {
                resolve(request.result);
            };
            
            request.onerror = function(event) {
                console.error("IndexedDB read error:", event.target.error);
                resolve(null);
            };
        });
    }
    
    function saveToIndexedDB(word, relations) {
        if (!db) return;
        
        const transaction = db.transaction(["wordRelations"], "readwrite");
        const store = transaction.objectStore("wordRelations");
        store.put({
            word: word,
            relations: relations,
            timestamp: Date.now()
        });
    }
    
    // Save score to leaderboard
    function saveScore(finalScore) {
        if (!db) return;
        
        const playerName = localStorage.getItem("playerName") || "Anonymous";
        const transaction = db.transaction(["leaderboard"], "readwrite");
        const store = transaction.objectStore("leaderboard");
        
        const scoreEntry = {
            name: playerName,
            score: finalScore,
            difficulty: difficultySelector.value,
            chainLength: wordChain.length,
            words: wordChain.join(", "),
            date: new Date().toISOString()
        };
        
        store.add(scoreEntry);
    }
    
    // Get leaderboard data
    function getLeaderboardData(period) {
        return new Promise((resolve, reject) => {
            if (!db) {
                resolve([]);
                return;
            }
            
            const transaction = db.transaction(["leaderboard"], "readonly");
            const store = transaction.objectStore("leaderboard");
            const scoreIndex = store.index("score");
            const dateIndex = store.index("date");
            
            let range = null;
            if (period === "daily") {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                range = IDBKeyRange.lowerBound(today.toISOString());
            } else if (period === "weekly") {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                range = IDBKeyRange.lowerBound(weekAgo.toISOString());
            }
            
            const request = range ? 
                dateIndex.openCursor(range, "prev") : 
                scoreIndex.openCursor(null, "prev");
            
            const results = [];
            
            request.onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor && results.length < 10) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = function(event) {
                console.error("Error getting leaderboard:", event.target.error);
                resolve([]);
            };
        });
    }

    // Calculate word rarity score (higher for rarer words)
    function calculateWordScore(word) {
        // Longer and less common letters = higher score
        let baseScore = 10; // Base score
        
        // Length bonus (longer words get more points)
        baseScore += word.length * 2;
        
        // Uncommon letter bonus
        const uncommonLetters = "jkqxz";
        for (let char of word) {
            if (uncommonLetters.includes(char)) {
                baseScore += 5;
            }
        }
        
        // Difficulty multiplier
        const diffMultiplier = {
            easy: 1,
            medium: 1.2,
            hard: 1.5,
            wild: 2
        };
        
        return Math.round(baseScore * diffMultiplier[difficultySelector.value]);
    }
    
    // Calculate speed bonus (points for quick responses)
    let lastSubmitTime = 0;
    function calculateSpeedBonus() {
        const now = Date.now();
        if (lastSubmitTime === 0) {
            lastSubmitTime = now;
            return 0;
        }
        
        const timeDiff = now - lastSubmitTime;
        lastSubmitTime = now;
        
        // Award bonus for quick responses
        if (timeDiff < 5000) return 15;
        if (timeDiff < 10000) return 10;
        if (timeDiff < 15000) return 5;
        return 0;
    }
    
    // Calculate hint penalty
    function calculateHintPenalty(hintLevel) {
        const penalties = {
            1: -5,
            2: -10,
            3: -20
        };
        
        return penalties[hintLevel] || 0;
    }

    // Initialize the game
    async function initializeGame() {
        // Reset game state
        wordChain = [];
        score = 0;
        streak = 0;
        usedHint = false;
        lastHintLevel = 0;
        gameStartTime = Date.now();
        
        // Reset UI elements
        hintDisplay.innerText = "";
        errorMessage.classList.add("hidden");
        
        // Get selected difficulty
        const difficulty = difficultySelector.value;
        
        // Get starting word and target word
        try {
            const startingWord = await getRandomEnglishWord(difficulty);
            wordChain.push(startingWord);
            
            // Get target word that's related but distant
            targetWord = await getTargetWord(startingWord, difficulty);
            
            // Update UI
            startWordDisplay.innerHTML = `Start: <strong>${startingWord}</strong> → Target: <strong>${targetWord}</strong>`;
            completionMessage.classList.add("hidden");
            updateWordChainDisplay();
            
            // Reset progress bar
            progressBar.style.width = "0%";
            
            // Reset timer
            lastSubmitTime = Date.now();
            
            // Focus input
            wordInput.focus();
            
            // Enable all hint buttons
            hintButtons.forEach(button => {
                button.disabled = false;
            });
        } catch (error) {
            console.error("Error initializing game:", error);
            hintDisplay.innerText = "Error loading game. Please try again.";
        }
    }

    // Update the word chain display
    function updateWordChainDisplay() {
        // Clear container
        wordChainContainer.innerHTML = "";
        
        // Add word cards
        wordChain.forEach((word, index) => {
            const wordCard = document.createElement("div");
            wordCard.className = "word-card";
            wordCard.textContent = word;
            
            // Check if it's the target word
            if (word === targetWord) {
                wordCard.classList.add("target-match");
            }
            
            // Add pulse animation to the last word
            if (index === wordChain.length - 1) {
                wordCard.classList.add("last-word-pulse");
            }
            
            // Add click event for word definition
            wordCard.addEventListener("click", async () => {
                await showWordDefinition(word);
            });
            
            wordChainContainer.appendChild(wordCard);
        });
        
        // Update score display
        scoreDisplay.innerHTML = `Score: ${score} | Streak: ${streak} | Chain: ${wordChain.length}/${targetChainLength}`;
        
        // Update progress bar
        const progress = (wordChain.length / targetChainLength) * 100;
        progressBar.style.width = `${progress}%`;

        // Draw connections between words
        drawWordConnections();

        // Check for game completion
        if (wordChain.length >= targetChainLength || 
            (wordChain.length > 1 && wordChain[wordChain.length - 1] === targetWord)) {
            // Add bonus if the last word matches the target
            if (wordChain[wordChain.length - 1] === targetWord) {
                const targetBonus = 50;
                score += targetBonus;
                hintDisplay.innerText = `+${targetBonus} bonus points for reaching the target word!`;
            }
            
            gameComplete();
        }
    }
    
    // Draw connections between word cards
    function drawWordConnections() {
        const wordCards = document.querySelectorAll(".word-card");
        if (wordCards.length < 2) return;
        
        // Clear existing SVG
        connectionSvg.innerHTML = "";
        
        // Set SVG dimensions
        const containerRect = wordChainContainer.getBoundingClientRect();
        connectionSvg.setAttribute("width", containerRect.width);
        connectionSvg.setAttribute("height", containerRect.height);
        
        // Draw connections
        for (let i = 0; i < wordCards.length - 1; i++) {
            const card1 = wordCards[i].getBoundingClientRect();
            const card2 = wordCards[i + 1].getBoundingClientRect();
            
            // Calculate positions relative to the container
            const x1 = card1.left + card1.width / 2 - containerRect.left;
            const y1 = card1.top + card1.height / 2 - containerRect.top;
            const x2 = card2.left + card2.width / 2 - containerRect.left;
            const y2 = card2.top + card2.height / 2 - containerRect.top;
            
            // Create line element
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", "rgba(255, 218, 106, 0.3)");
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", "4 2");
            
            connectionSvg.appendChild(line);
        }
    }
    
    // Show word definition in modal
    async function showWordDefinition(word) {
        modalWord.textContent = word;
        modalBody.innerHTML = "<p>Loading definition...</p>";
        
        // Show modal
        definitionModal.classList.remove("hidden");
        definitionModal.classList.add("visible");
        
        // Fetch definition
        const definitionData = await getWordDefinition(word);
        
        if (definitionData) {
            let definitionHTML = "";
            
            definitionData.meanings.forEach(meaning => {
                definitionHTML += `<div class="definition-item">`;
                definitionHTML += `<div class="part-of-speech">${meaning.partOfSpeech}</div>`;
                
                meaning.definitions.slice(0, 3).forEach((def, index) => {
                    definitionHTML += `<div class="definition-text">${index + 1}. ${def.definition}</div>`;
                    
                    if (def.example) {
                        definitionHTML += `<div class="example">"${def.example}"</div>`;
                    }
                });
                
                if (meaning.synonyms && meaning.synonyms.length > 0) {
                    definitionHTML += `<div class="synonyms">`;
                    meaning.synonyms.slice(0, 5).forEach(synonym => {
                        definitionHTML += `<span class="synonym-chip">${synonym}</span>`;
                    });
                    definitionHTML += `</div>`;
                }
                
                definitionHTML += `</div>`;
            });
            
            modalBody.innerHTML = definitionHTML;
        } else {
            modalBody.innerHTML = "<p>No definition found for this word.</p>";
        }
    }
    
    // Handle game completion
    function gameComplete() {
        // Calculate time bonus
        const gameTimeSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
        const timeBonus = Math.max(0, 300 - gameTimeSeconds);
        score += timeBonus;
        
        // Update UI
        completionMessage.innerHTML = `
            <h3>🎉 Congratulations! 🎉</h3>
            <p>You completed a word chain with ${wordChain.length} words!</p>
            <p>Final Score: <strong>${score}</strong> (includes ${timeBonus} time bonus)</p>
            <p>Time: ${formatTime(gameTimeSeconds)}</p>
            <div class="share-buttons">
                <button id="share-result" class="share-button social-share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8L22 12L18 16"></path>
                        <path d="M2 12H22"></path>
                    </svg>
                    Share
                </button>
                <button id="copy-result" class="share-button copy-share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                </button>
            </div>
            <button id="play-again" class="play-again">Play Again</button>
        `;
        completionMessage.classList.remove("hidden");
        
        // Play sound effect
        if (soundEnabled) {
            audioEffects.complete.play();
        }
        
        // Save score to leaderboard
        saveScore(score);
        
        // Add event listeners to buttons
        document.getElementById("play-again").addEventListener("click", initializeGame);
        document.getElementById("share-result").addEventListener("click", shareResult);
        document.getElementById("copy-result").addEventListener("click", copyResult);
    }
    
    // Format time in MM:SS
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // Share result
    function shareResult() {
        const text = `I scored ${score} points in Word Chain Challenge!\nChain: ${wordChain.join(' → ')}\nPlay at [game link]`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Word Chain Challenge Result',
                text: text
            }).catch(err => {
                console.error('Error sharing:', err);
            });
        } else {
            copyToClipboard(text);
            alert('Result copied to clipboard!');
        }
    }
    
    // Copy result to clipboard
    function copyResult() {
        const text = `I scored ${score} points in Word Chain Challenge!\nChain: ${wordChain.join(' → ')}`;
        copyToClipboard(text);
        
        const copyButton = document.getElementById("copy-result");
        copyButton.textContent = "Copied!";
        setTimeout(() => {
            copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
            `;
        }, 2000);
    }
    
    // Helper function to copy text to clipboard
    function copyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
    
    // Update leaderboard UI
    async function updateLeaderboardUI(period) {
        const data = await getLeaderboardData(period);
        
        if (data.length === 0) {
            leaderboardContent.innerHTML = "<p>No scores yet. Be the first!</p>";
            return;
        }
        
        let html = `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th class="rank">#</th>
                        <th>Player</th>
                        <th>Score</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.forEach((entry, index) => {
            const date = new Date(entry.date);
            const dateStr = date.toLocaleDateString();
            
            html += `
                <tr>
                    <td class="rank rank-${index + 1}">${index + 1}</td>
                    <td>${entry.name}</td>
                    <td>${entry.score}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        leaderboardContent.innerHTML = html;
    }

    // Submit button event
    submitButton.addEventListener("click", async () => {
        const newWord = wordInput.value.trim().toLowerCase();
        errorMessage.classList.add("hidden");
        
        // Validate input
        if (!newWord) return;
        if (wordChain.includes(newWord)) {
            showError("Word already used!");
            return;
        }
        
        // Validate it's a real word (length > 2)
        if (newWord.length < 3) {
            showError("Word is too short!");
            return;
        }

        const lastWord = wordChain[wordChain.length - 1].toLowerCase();
        const relatedWords = await getRelatedEnglishWords(lastWord);
        
        // Check if word is related or is the target word
        if (relatedWords.map(w => w.toLowerCase()).includes(newWord) || 
            (wordChain.length > 1 && newWord === targetWord)) {
            
            // Play success sound
            if (soundEnabled) {
                audioEffects.success.play();
            }
            
            // Calculate points
            const wordScore = calculateWordScore(newWord);
            const speedBonus = calculateSpeedBonus();
            const streakBonus = Math.floor(streak * 0.5) * 10;
            const hintPenalty = usedHint ? calculateHintPenalty(lastHintLevel) : 0;
            
            // Check for target match bonus
            const targetBonus = newWord === targetWord ? 30 : 0;
            
            // Update game state
            wordChain.push(newWord);
            streak++;
            score += wordScore + speedBonus + streakBonus + hintPenalty + targetBonus;
            
            // Reset hint state
            usedHint = false;
            lastHintLevel = 0;
            
            // Update UI with point breakdown
            let scoreBreakdown = `+${wordScore} points`;
            if (speedBonus > 0) scoreBreakdown += ` (+${speedBonus} speed)`;
            if (streakBonus > 0) scoreBreakdown += ` (+${streakBonus} streak)`;
            if (hintPenalty < 0) scoreBreakdown += ` (${hintPenalty} hint)`;
            if (targetBonus > 0) scoreBreakdown += ` (+${targetBonus} target)`;
                    
                    // Update UI with score breakdown
                    hintDisplay.innerText = `${scoreBreakdown}`;
                    updateWordChainDisplay();
                    
                    // Clear input field
                    wordInput.value = "";
                    wordInput.focus();
                } else {
                    // Play error sound
                    if (soundEnabled) {
                        audioEffects.error.play();
                    }
                    
                    // Reset streak
                    streak = 0;
                    
                    // Show error message
                    showError("Word not related! Try another word.");
                }
    });
    
    // Enter key support for word input
    wordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            submitButton.click();
        }
    });
    
    // Hint buttons
    // Hint buttons
hintButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const hintLevel = parseInt(button.dataset.level);
        button.disabled = true;
        lastHintLevel = hintLevel;
        usedHint = true;
        
        // Play hint sound
        if (soundEnabled) {
            audioEffects.hint.play();
        }
        
        const lastWord = wordChain[wordChain.length - 1];
        
        try {
            // Force a fresh API call by bypassing cache
            const relatedWords = await fetchRelatedWordsDirect(lastWord, 30);
            
            // Make sure we have words to work with
            if (!relatedWords || relatedWords.length === 0) {
                hintDisplay.innerText = "No hints available. Try a different word.";
                return;
            }
            
            // Filter out words already in the chain
            const filteredWords = relatedWords.filter(word => 
                !wordChain.includes(word) && 
                word.length >= 3 && 
                /^[a-z]+$/.test(word)
            );
            
            if (filteredWords.length === 0) {
                hintDisplay.innerText = "No hints available. Try a different word.";
                return;
            }
            
            // Sort by relevance (in this case, just random for demo)
            const sortedOptions = filteredWords
                .sort(() => 0.5 - Math.random())
                .slice(0, 5);
            
            // Different hint types based on level
            switch (hintLevel) {
                case 1: // Just the first letter
                    const randomOption = sortedOptions[0];
                    hintDisplay.innerText = `Hint: Try a word starting with "${randomOption[0].toUpperCase()}"`;
                    break;
                    
                case 2: // Word pattern (length and some letters)
                    const patternWord = sortedOptions[0];
                    let pattern = "";
                    
                    for (let i = 0; i < patternWord.length; i++) {
                        if (i === 0 || i === patternWord.length - 1 || Math.random() < 0.3) {
                            pattern += patternWord[i].toUpperCase();
                        } else {
                            pattern += "_ ";
                        }
                    }
                    
                    hintDisplay.innerText = `Hint: Try something like "${pattern}"`;
                    break;
                    
                case 3: // Direct suggestion
                    hintDisplay.innerText = `Hint: Try one of these: ${sortedOptions.slice(0, 3).join(", ")}`;
                    break;
            }
        } catch (error) {
            console.error("Error getting hints:", error);
            hintDisplay.innerText = "Couldn't get hints. Please try again.";
            // Re-enable the button if there was an error
            button.disabled = false;
        }
    });
});

// Add this new function that bypasses cache
async function fetchRelatedWordsDirect(word, limit = 10) {
    try {
        const response = await fetch(`https://api.conceptnet.io/query?start=/c/en/${encodeURIComponent(word)}&rel=/r/RelatedTo&limit=${limit}`);
        if (!response.ok) throw new Error('API request failed');
        
        const data = await response.json();
        const relatedWords = data.edges
            .map(edge => edge.end.term.split('/').pop().toLowerCase()) 
            .filter(label => /^[a-zA-Z]+$/.test(label));
        
        return relatedWords;
    } catch (error) {
        console.error("Error fetching related words directly:", error);
        return [];
    }
}
    
    // Toggle sound
    soundToggle.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem("soundEnabled", soundEnabled);
        
        // Update icon
        soundToggle.innerHTML = soundEnabled ? 
            `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>` : 
            `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>`;
    });
    
    // Show error message
    function showError(message) {
        errorMessage.innerText = `❌ ${message}`;
        errorMessage.classList.remove("hidden");
        
        // Clear after 3 seconds
        setTimeout(() => {
            errorMessage.classList.add("hidden");
        }, 3000);
    }
    
    // Leaderboard button
    leaderboardButton.addEventListener("click", () => {
        leaderboardModal.classList.remove("hidden");
        leaderboardModal.classList.add("visible");
        updateLeaderboardUI("daily");
    });
    
    // Close leaderboard
    closeLeaderboard.addEventListener("click", () => {
        leaderboardModal.classList.remove("visible");
        leaderboardModal.classList.add("hidden");
    });
    
    // Close definition modal
    closeModal.addEventListener("click", () => {
        definitionModal.classList.remove("visible");
        definitionModal.classList.add("hidden");
    });
    
    // Tab buttons
    tabButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            
            // Update leaderboard
            const period = button.dataset.period;
            updateLeaderboardUI(period);
        });
    });
    
    // Difficulty selector
    difficultySelector.addEventListener("change", () => {
        // Start a new game with the selected difficulty
        initializeGame();
    });
    
    // Close modals when clicking outside
    window.addEventListener("click", (e) => {
        if (e.target === definitionModal) {
            definitionModal.classList.remove("visible");
            definitionModal.classList.add("hidden");
        }
        
        if (e.target === leaderboardModal) {
            leaderboardModal.classList.remove("visible");
            leaderboardModal.classList.add("hidden");
        }
    });
    
    // Handle window resize for word connections
    window.addEventListener("resize", () => {
        drawWordConnections();
    });
    
    // Initialize game when DOM is ready
    // Note: This is already called in the DB success handler
});