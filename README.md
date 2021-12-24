# Steam hours bot
 Tool that simulate your game activity.

---

### How to use: 
1. Clone repo and install dependencies.
```sh
git clone https://github.com/TheSainEyereg/Steam-hours-bot.git
cd Steam-hours-bot
npm i
```
2. Create `config.json` like this:
```json
{
	"steamLogin" : "GabeN@valvesoftware.com",
	"steamPassword" : "MoolyFTW",
	"appIDs": [730]
}
```
3. Run bot:
```sh
node src/index.js
```