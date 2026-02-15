# Valorant Strat Maker

A premium, web-based tool for creating and saving Valorant team compositions and strategies. 
Built with modern web technologies (HTML5, CSS3, Vanilla JS) for maximum performance and compatibility.

## Features
- **Map Selection**: Choose from all current competitive maps.
- **Composition Builder**: Drag and drop agents into 5 slots.
- **Role Filters**: Quickly find Duelists, Controllers, Initiators, or Sentinels.
- **Strategy Notes**: Save specific execute plans or notes for each comp.
- **Local Persistence**: Automatically saves your comps to your browser's local storage.
- **Responsive Design**: Works on desktop and tablets.

## How to Run Locally
Since this is a static website, you can simply open `index.html` in your browser.
**Note**: Some browsers might block the data fetching from the API when opening as a local file. 
For the best experience, use a local server (like VS Code's "Live Server" extension) or deploy to GitHub Pages.

## How to Deploy to GitHub Pages
1. Push this repository to GitHub.
2. Go to your Repository Settings -> Pages.
3. Select "Deploy from a branch" -> "main" (or "master") -> "/ (root)".
4. Click Save.
5. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

## Tech Stack
- **HTML5**: Semantic structure.
- **CSS3**: Custom variables, Flexbox/Grid, Glassmorphism design system.
- **JavaScript (ES6+)**: Async/Await data fetching, DOM manipulation, LocalStorage.
- **API**: Uses [Valorant-API.com](https://valorant-api.com) for up-to-date game data.
