import SteamUser from "steam-user";

interface MyLogInDetails {
	accountName: string; // Yep this is illegal, but in overridden logOn we remove it 
	refreshToken: string;
	machineName?: string;
}

export default class MySteamUser extends SteamUser {
	private connected: boolean = false;
	private accountName: string | null = null;
	private refreshToken: string | null = null;

	public isConnected = () => this.connected;
	public getAccountName = () => this.accountName;
	public getRefreshToken = () => this.refreshToken;

	constructor() {
		super();

		this.on("loggedOn", () => this.connected = true);
		this.on("disconnected", () => this.connected = false);
		this.on("error", () => this.connected = false);
	}

	logIn = (details: MyLogInDetails) => {
		this.accountName = details.accountName;
		this.refreshToken = details.refreshToken;
		
		// Ugly TS hack
		delete (details as Omit<MyLogInDetails, "accountName"> & {accountName?: string}).accountName;

		details.machineName = details.machineName ?? "SteamHoursBooster";
		
		this.on("error", (err) => console.log(`Error at "${this.accountName}": ${err}`));
		super.logOn(details);
	};

	relogIn = () => {
		const { refreshToken } = this;
		if (!refreshToken) throw new Error("No refreshToken");

		super.logOn({ refreshToken });
	};

	logOff = () => {
		return new Promise<void>(resolve => {
			this.once("disconnected", () => resolve());
			super.logOff();
		});
	};
}