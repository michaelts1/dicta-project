import fetch from "node-fetch";
import logUpdate from "log-update";

/* A bundle of different modules for this project */

/*		-- talmud --
	Raw code is shared under MIT License, Copyright (c) 2021 Michael Tsaban.
	Returned text might be shared under another license. Refer to
	https://github.com/Sefaria/Sefaria-Export/blob/master/LICENSE.md for more info */

export const talmud = (function() {
	const talmudTree = {
		Zeraim: [
			"Berakhot",
			//"Peah", -- does not exist on Sefaria
			//"Demai", -- does not exist on Sefaria
			//"Kilayim", -- does not exist on Sefaria
			//"Sheviit", -- does not exist on Sefaria
			//"Terumot", -- does not exist on Sefaria
			//"Maaserot", -- does not exist on Sefaria
			//"Challa", -- does not exist on Sefaria
			//"Orlah", -- does not exist on Sefaria
			//"Bikkurim", -- does not exist on Sefaria
		],
		Moed: [
			"Shabbat",
			"Eruvin",
			"Pesachim",
			//"Shekalim", -- does not exist on Sefaria
			"Yoma",
			"Sukkah",
			"Beitzah",
			"Rosh Hashanah",
			"Taanit",
			"Megillah",
			"Moed Katan",
			"Chagigah",
		],
		Nashim: [
			"Yevamot",
			"Ketubot",
			"Nedarim",
			"Nazir",
			"Sotah",
			"Gittin",
			"Kiddushin",
		],
		Nezikin: [
			"Bava Kamma",
			"Bava Metzia",
			"Bava Batra",
			"Sanhedrin",
			"Makkot",
			"Shevuot",
			//"Eduyot", -- does not exist on Sefaria
			"Avodah Zarah",
			//"Pirkei Avot", -- does not exist on Sefaria
			"Horayot",
		],
		Kodashim: [
			"Zevachim",
			"Menachot",
			"Chullin",
			"Bekhorot",
			"Arakhin",
			"Temurah",
			"Keritot",
			"Meilah",
			"Tamid",
			//"Middot", -- does not exist on Sefaria
			//"Kinnim", -- does not exist on Sefaria
		],
		Tahorot: [
			//"Keilim", -- does not exist on Sefaria
			//"Oholot", -- does not exist on Sefaria
			//"Negaim", -- does not exist on Sefaria
			//"Parah", -- does not exist on Sefaria
			//"Tohorot", -- does not exist on Sefaria
			//"Mikvaot", -- does not exist on Sefaria
			"Niddah",
			//"Makshirin", -- does not exist on Sefaria
			//"Zavim", -- does not exist on Sefaria
			//"Tevul Yom", -- does not exist on Sefaria
			//"Yadayim", -- does not exist on Sefaria
			//"Uktim", -- does not exist on Sefaria
		],
	};

	const translations = {
		"Avodah Zarah": "עבודה זרה",
		"Bava Batra": "בבא בתרא",
		"Bava Kamma": "בבא קמא",
		"Bava Metzia": "בבא מציאה",
		"Moed Katan": "מועד קטן",
		"Rosh Hashanah": "ראש השנה",
		Arakhin: "ערכין",
		Beitzah: "ביצה",
		Berakhot: "ברכות",
		Bekhorot: "בכורות",
		Chagigah: "חגיגה",
		Chullin: "חולין",
		Eruvin: "עירובין",
		Gittin: "גיטין",
		Horayot: "הוריות",
		Keritot: "כריתות",
		Ketubot: "כתובות",
		Kiddushin: "קידושין",
		Makkot: "מכות",
		Megillah: "מגילה",
		Meilah: "מעילה",
		Menachot: "מנחות",
		Nazir: "נזיר",
		Nedarim: "נדרים",
		Niddah: "נידה",
		Pesachim: "פסחים",
		Sanhedrin: "סנהדרין",
		Shabbat: "שבת",
		Shevuot: "שבועות",
		Sotah: "סוטה",
		Sukkah: "סוכה",
		Taanit: "תענית",
		Tamid: "תמיד",
		Temurah: "תמורה",
		Yevamot: "יבמות",
		Yoma: "יומא",
		Zevachim: "זבחים",
	};

	/**
	 * @param {string} masechet English name
	 * @returns {string} Hebrew name
	 */
	function masechetName(masechet) {
		return translations[masechet] ?? "לא ידוע";
	}

	/**
	 * @returns {Promise<{ [masechet: string]: string; }>}
	 */
	async function getTalmud() {
		// Get from cache
		if (talmudTree.all) return talmudTree.all;

		/** @type {{ [masechet: string]: string; }} */
		const result = {};

		for (const [seder, masechtot] of Object.entries(talmudTree)) {
			for (const masechet of masechtot) {
				logUpdate(`Fetching masechet ${masechet}...`);

				const url =
					"https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/json/Talmud/" +
					`Bavli/Seder%20${seder}/${masechet}/Hebrew/Wikisource%20Talmud%20Bavli.json`;

				const json = await (await fetch(url)).json();

				result[masechet] = json.text.flat().join(" ")
					.replace(/([^:])( <big><strong>גמ)/g, "$1: $2") // Add missing colons
					.replace(/(הדרן עלך[^:]+?)</g, "$1:<") // Insert colons after `הדרן עלך` if needed
					.replace(/[\t\n]/g, " ") // Convert single line breaks and tabs
					.replace(/\s{2,}/g, " ") // Collapse white space
					.replace(/(?<!<strong>)מתני׳/g, "מתני'") // Apostrophes - remove misplaced
					.replace(/(?<!<strong>)גמ׳/g, "גמ'")     // Apostrophes - remove misplaced
					.replace(/(?<=<strong>)מתני'/g, "מתני׳") // Apostrophes - add missing
					.replace(/(?<=<strong>)גמ'/g, "גמ׳")     // Apostrophes - add missing
					.replace(/מתני'(?=\s+<)/g, "מתני׳")      // Apostrophes - add missing
					.replace(/(: גמ) /g, "$1׳ ")              // Apostrophes - add missing
					.replace(/[<>\\a-z/]/g, "") // Remove html tags e.g. <big>, </strong> etc.
					.trim(); // Trim leading/trailing whitespace
			}
		}

		// Cache for later use
		talmudTree.all = result;

		return result;
	}

	return {
		masechetName,
		getTalmud,
	};
})();

/**		-- updateProgress --
	MIT License, Copyright (c) 2021 Michael Tsaban */
export const updateProgress = (function() {
	const cache = {
		citation: 0,
		masechet: 0,
		mishna: 0,
	};

	/**
	* Shows progress to the user
	* @param {"masechet" | "mishna" | "citation"} part Update this part
	* @param {number} current Number of completed operations
	* @param {number} total Number of total operations
	*/
	return function(part, current, total) {
		cache[part] = Math.floor((current ?? 0) / (total ?? 1) * 100);

		if (cache.masechet >= 100 && cache.mishna >= 100 && cache.citation >= 100) {
			logUpdate.clear();
			logUpdate.done();
		} else {
			logUpdate(
`Scanning masechtot: ${cache.masechet}%
  ┗━━━┳ Scanning mishnayot: ${cache.mishna}%
      ┗━━━━ Scanning citations: ${cache.citation}%`);
		}
	};
})();

/*		-- js-levenshtein --
	Taken and modified from: https://github.com/gustf/js-levenshtein/blob/master/index.js
	MIT License. Copyright (c) 2017 Gustaf Andersson */
export const levenshtein = (function()
{
	function _min(d0, d1, d2, bx, ay)
	{
		return d0 < d1 || d2 < d1
			? d0 > d2
				? d2 + 1
				: d0 + 1
			: bx === ay
				? d1
				: d1 + 1;
	}

	return function(a, b)
	{
		if (a === b) {
			return 0;
		}

		if (a.length > b.length) {
			var tmp = a;
			a = b;
			b = tmp;
		}

		var la = a.length;
		var lb = b.length;

		while (la > 0 && (a.charCodeAt(la - 1) === b.charCodeAt(lb - 1))) {
			la--;
			lb--;
		}

		var offset = 0;

		while (offset < la && (a.charCodeAt(offset) === b.charCodeAt(offset))) {
			offset++;
		}

		la -= offset;
		lb -= offset;

		if (la === 0 || lb < 3) {
			return lb;
		}

		var x = 0;
		var y;
		var d0;
		var d1;
		var d2;
		var d3;
		var dd;
		var dy;
		var ay;
		var bx0;
		var bx1;
		var bx2;
		var bx3;

		var vector = [];

		for (y = 0; y < la; y++) {
			vector.push(y + 1);
			vector.push(a.charCodeAt(offset + y));
		}

		var len = vector.length - 1;

		for (; x < lb - 3;) {
			bx0 = b.charCodeAt(offset + (d0 = x));
			bx1 = b.charCodeAt(offset + (d1 = x + 1));
			bx2 = b.charCodeAt(offset + (d2 = x + 2));
			bx3 = b.charCodeAt(offset + (d3 = x + 3));
			dd = (x += 4);
			for (y = 0; y < len; y += 2) {
				dy = vector[y];
				ay = vector[y + 1];
				d0 = _min(dy, d0, d1, bx0, ay);
				d1 = _min(d0, d1, d2, bx1, ay);
				d2 = _min(d1, d2, d3, bx2, ay);
				dd = _min(d2, d3, dd, bx3, ay);
				vector[y] = dd;
				d3 = d2;
				d2 = d1;
				d1 = d0;
				d0 = dy;
			}
		}

		for (; x < lb;) {
			bx0 = b.charCodeAt(offset + (d0 = x));
			dd = ++x;
			for (y = 0; y < len; y += 2) {
				dy = vector[y];
				vector[y] = dd = _min(dy, d0, dd, bx0, vector[y + 1]);
				d0 = dy;
			}
		}

		return dd;
	};
})();
