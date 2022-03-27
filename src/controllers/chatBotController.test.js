const checkInDB = require('./chatBotController');
const capitalizeFirstLetter = require('./chatBotController');
const countWords = require('./chatBotController');
const countBirthDays = require('./chatBotController');
const extractDate = require('./chatBotController');
const extractName = require('./chatBotController');

test("Function checkInDB should check if user is in the array of stored messages by returning -1 or the position of user in the DB", () => {
	let obj = [
		{
		_id: "5f58d5d6da331d003189ab09",
		text: [ 'Hi', 'Sure', 'Gabriel' ],
		senderId: '107576601087916'
		},
		{
		_id: "5f58d5fdda331d003189ab0c",
		text: [ 'Hi' ],
		senderId: '111019327407043'
		}
	];

	expect(checkInDB(obj, obj[0].senderId)).toBe(0);
	expect(checkInDB(obj, obj[1].senderId)).toBe(1);
	expect(checkInDB(obj, "someRandomId123")).toBe(-1);
});

test("Function capitalizeFirstLetter should capitalize first letter of a string", () => {
	let str = "hey";

	expect(capitalizeFirstLetter(str)).not.toBe(str);
	expect(capitalizeFirstLetter(str)).toBe("Hey");
});

test("Function countWords should count number of words in a string", () => {
	let str = "Here is a text containing seven words";

	expect(countWords(str)).toBe(7);
});

test("Function countBirthDays should count number of days until next birthday", () => {
	let date = "2000-03-25";

	expect(countBirthDays(date)).toBe(169);
});

test("Function extractDate should extract date from Messenger Bot formatted reply", () => {
	let strDate = "Is 2000-03-25 your birth date?";

	expect(extractDate(strDate)).toBe("2000-03-25");
});

test("Function extractName should extract user first name from Messenger Bot formatted reply", () => {
	let strName = "Is Gabriel your first name?";

	expect(extractName(strName)).toBe("Gabriel");
});