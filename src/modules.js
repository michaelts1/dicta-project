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
		"Avodah Zarah": "?????????? ??????",
		"Bava Batra": "?????? ????????",
		"Bava Kamma": "?????? ??????",
		"Bava Metzia": "?????? ??????????",
		"Moed Katan": "???????? ??????",
		"Rosh Hashanah": "?????? ????????",
		Arakhin: "??????????",
		Beitzah: "????????",
		Berakhot: "??????????",
		Bekhorot: "????????????",
		Chagigah: "??????????",
		Chullin: "??????????",
		Eruvin: "??????????????",
		Gittin: "??????????",
		Horayot: "????????????",
		Keritot: "????????????",
		Ketubot: "????????????",
		Kiddushin: "??????????????",
		Makkot: "????????",
		Megillah: "??????????",
		Meilah: "??????????",
		Menachot: "??????????",
		Nazir: "????????",
		Nedarim: "??????????",
		Niddah: "????????",
		Pesachim: "??????????",
		Sanhedrin: "??????????????",
		Shabbat: "??????",
		Shevuot: "????????????",
		Sotah: "????????",
		Sukkah: "????????",
		Taanit: "??????????",
		Tamid: "????????",
		Temurah: "??????????",
		Yevamot: "??????????",
		Yoma: "????????",
		Zevachim: "??????????",
	};

	/**
	 * @param {string} masechet English name
	 * @returns {string} Hebrew name
	 */
	function masechetName(masechet) {
		return translations[masechet] ?? "???? ????????";
	}

	/** @returns {Promise<{ [masechet: string]: string; }>} */
	async function getTalmud() {
		if (talmudTree.all) return talmudTree.all; // Get from cache

		/** @type {{ [masechet: string]: string; }} */
		const result = {};

		for (const [seder, masechtot] of Object.entries(talmudTree)) {
			for (const masechet of masechtot) {
				$("#progress").text(`???????? ???? ???????? ${masechetName(masechet)}...`);

				const url =
					"https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/json/Talmud/" +
					`Bavli/Seder%20${seder}/${masechet}/Hebrew/Wikisource%20Talmud%20Bavli.json`;

				const json = await (await fetch(url)).json();

				result[masechet] = json.text.flat().join(" ")
					.replace(/([^:])( <big><strong>????)/g, "$1: $2") // Add missing colons
					.replace(/(???????? ??????[^:]+?)</g, "$1:<") // Insert colons after `???????? ??????` if needed
					.replace(/[\t\n]/g, " ") // Convert single line breaks and tabs
					.replace(/\s{2,}/g, " ") // Collapse white space
					.replace(/(?<!<strong>)??????????/g, "????????'") // Apostrophes - remove misplaced
					.replace(/(?<!<strong>)??????/g, "????'")     // Apostrophes - remove misplaced
					.replace(/(?<=<strong>)????????'/g, "??????????") // Apostrophes - add missing
					.replace(/(?<=<strong>)????'/g, "??????")     // Apostrophes - add missing
					.replace(/????????'(?=\s+<)/g, "??????????")      // Apostrophes - add missing
					.replace(/(: ????) /g, "$1?? ")              // Apostrophes - add missing
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
	return async function(part, current, total) {
		cache[part] = Math.floor((current ?? 0) / (total ?? 1) * 100);

		if (cache.masechet >= 100 && cache.mishna >= 100 && cache.citation >= 100) {
			$("#progress").text("");
		} else {
			$("#progress").html(
				`???????? ????????????: ${cache.masechet}%\n` +
				`?????? ???????? ????????????: ${cache.mishna}%\n` +
				`        ?????? ???????? ????????????: ${(cache.citation + "%").padEnd(4)}`,
			);
		}

		// Give browser time to render the new text
		await new Promise(resolve => setTimeout(resolve));
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
