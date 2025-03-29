# Word Chain Challenge

Word Chain Challenge is an interactive word association game where players build chains of related words. Test your vocabulary and creative thinking as you link words together to form a continuous chain.

## 🎮 How to Play

1. **Start with the given word** and build a chain of 10 related words
2. **Each word must be logically related to the previous one**
3. You'll see a target word - you don't have to reach it directly, but doing so gives you bonus points!
4. Earn points for:
   - Using rare words
   - Responding quickly
   - Maintaining streaks
   - Reaching the target word
5. Use hints if you get stuck (costs points)

## ✨ Features

- **Four difficulty levels**: Easy, Medium, Hard, and Wild!
- **Interactive word cards**: Click on any word to see its definition
- **Leaderboards**: Daily, weekly, and all-time high scores
- **Daily streaks**: Earn streak bonuses for playing consistently
- **Dynamic scoring system**: Get rewarded for speed, word rarity, and reaching targets
- **Hint system**: Three levels of hints when you need assistance
- **Share results**: Easily share your completed chains with friends
- **Sound effects**: Toggle-able audio feedback

## 🛠️ Technical Details

The game uses:
- **ConceptNet API** for word relationships
- **Dictionary API** for word definitions
- **IndexedDB** for local storage of game data and leaderboards
- **SVG graphics** for visualizing word connections
- **Responsive design** for play on different devices

## 🚀 Getting Started

### Prerequisites
- A modern web browser
- Internet connection (for API access)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/word-chain-challenge.git
```

2. Navigate to the project directory:
```bash
cd word-chain-challenge
```

3. Open `index.html` in your browser or serve with a local server:
```bash
# Using Python's built-in server (Python 3)
python -m http.server

# Or with Node.js's http-server
npx http-server
```

## 🧠 Game Mechanics

### Word Relationships
Words are considered related if they appear in the ConceptNet database with a "RelatedTo" relationship. This creates natural, intuitive connections between words.

### Scoring System
- **Base word score**: Based on word length and letter rarity
- **Speed bonus**: Faster responses earn additional points
- **Streak bonus**: Consecutive successful words increase your multiplier
- **Target word bonus**: Reaching the target word gives a significant bonus
- **Difficulty multiplier**: Higher difficulties multiply your score

### Hint System
- **Level 1**: Shows the first letter of a valid word (-5 points)
- **Level 2**: Shows a pattern revealing some letters (-10 points)
- **Level 3**: Directly suggests multiple valid words (-20 points)

## 🧪 Future Improvements

- Add multiplayer mode
- Implement themed word chains (animals, food, etc.)
- Add more languages
- Create custom word packs
- Implement user accounts for cross-device progress

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ConceptNet](https://conceptnet.io/) for providing the word relationship API
- [Dictionary API](https://dictionaryapi.dev/) for word definitions
- [Feather Icons](https://feathericons.com/) for UI icons
- [Mixkit](https://mixkit.co/) for sound effects
