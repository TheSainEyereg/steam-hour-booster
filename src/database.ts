import Database from "better-sqlite3";

interface AccountModel {
	steamID: string;
	accountName: string;
	refreshToken: string;
	appIDs: string;
}

const db = new Database("database.db");
db.exec(`CREATE TABLE IF NOT EXISTS "accounts" (
	"steamID" TEXT PRIMARY KEY,
	"accountName" TEXT,
	"refreshToken" TEXT,
	"appIDs" TEXT
)`);

export const getAllAccounts = () => db.prepare("SELECT * FROM \"accounts\"").all() as AccountModel[];
export const getAccount = (steamID: string) => db.prepare("SELECT * FROM \"accounts\" WHERE \"steamID\" = ?").get(steamID) as AccountModel;

const appIDsCache: { [key: string]: string[] } = {};
export const getAccountAppIDs = (steamID: string) => {
	if (!appIDsCache[steamID]) {
		const res = db.prepare("SELECT \"appIDs\" FROM \"accounts\" WHERE \"steamID\" = ?").get(steamID) as AccountModel;
		return appIDsCache[steamID] = res.appIDs.split(";");
	}
	return appIDsCache[steamID];
};
export const addAccountAppIDs = (steamID: string, appIDs: string[]) => {
	if (!appIDsCache[steamID]) getAccountAppIDs(steamID);
	appIDsCache[steamID].push(...appIDs);
	db.prepare("UPDATE \"accounts\" SET \"appIDs\" = ? WHERE \"steamID\" = ?").run(appIDs.join(";"), steamID);
};
export const deleteAccountAppIDs = (steamID: string, appIDs: string[]) => {
	if (!appIDsCache[steamID]) getAccountAppIDs(steamID);
	appIDs.forEach(appID => appIDsCache[steamID].splice(appIDsCache[steamID].indexOf(appID), 1));
	db.prepare("UPDATE \"accounts\" SET \"appIDs\" = ? WHERE \"steamID\" = ?").run(appIDs.join(";"), steamID);
};

export const saveNewAccount = (steamID: string, accountName: string, refreshToken: string, appIDs: string[]) =>
	db.prepare("INSERT INTO \"accounts\" (\"steamID\", \"accountName\", \"refreshToken\", \"appIDs\") VALUES (?, ?, ?, ?)")
		.run(steamID, accountName, refreshToken , appIDs.join(";"));

export const updateAccountRrefreshToken = (steamID: string, refreshToken: string) => db.prepare("UPDATE \"accounts\" SET \"refreshToken\" = ? WHERE \"steamID\" = ?").run(refreshToken, steamID);

export const deleteAccount = (steamID: string) => {
	delete appIDsCache[steamID];
	return db.prepare("DELETE FROM \"accounts\" WHERE \"steamID\" = ?").run(steamID);
};