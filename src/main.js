import { talmud, levenshtein, updateProgress } from "./modules.js";

// Sensitivity
const levMinMishna = 15;
const levMinCitations = 5;

/**
 * @typedef {Object} segment
 * @property {number} start
 * @property {number} end
 * @property {string} text
 */
/**
 * @typedef {Object} citation
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {number} inRow
 * @property {boolean} isPartOfRow
 * @property {boolean} inMiddleOfRow
 * @property {number} levFromNext
 */
/**
 * @typedef {Object} mishna
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {citation[]} citations
 */

/** Splits the masechet at every mishna
 * @param {string} masechet
 * @returns {mishna[]}
 */
function getMishnayot(masechet) {
	const mishnayot = [];

	// This regex was inspired by https://stackoverflow.com/a/8374980, and captures a mishna
	const mishnaRegExp = new RegExp("(?:^|מתני׳)(?:.(?!(?:גמ׳|הדרן עלך)))+", "g");

	let execResult = null;
	while ((execResult = mishnaRegExp.exec(masechet)) !== null) {
		mishnayot.push({
			start: execResult.index,
			end: execResult.index + execResult[0].length,
			text: execResult[0],
			citations: [],
		});
	}

	return mishnayot;
}

/** Splits text from the gemara at every colon
 * @param {string} gemara
 * @returns {segment[]}
 */
function getSegments(gemara) {
	const colonRegExp = /(?<=:) /g;
	const colonsIndexes = [];

	let execResult = null;
	while ((execResult = colonRegExp.exec(gemara)) !== null) {
		colonsIndexes.push(execResult.index);
	}

	const segments = [];

	// Store segments (ignore the last colon index)
	for (let i = 0; i < colonsIndexes.length-1; i++) {
		const indices = [
			colonsIndexes[i]+1, // From after the initial space
			colonsIndexes[i+1], // To the next colon
		];
		segments.push({
			start: indices[0],
			end: indices[1],
			text: gemara.substring(indices[0], indices[1]),
		});
	}

	return segments;
}

/**
 * Strips non-hebrew letters from a string
 * @function stripText
 * @param {string} str
 * @returns {string}
 */
const stripText = str => str.replace(/[^\u05d0-\u05ea ]/g, "");

/** Returns the levenshtein distance between a string and a substring
 * @param {string} str
 * @param {string} substr
 * @returns {number}
 */
function levSubstring(str, substr) {
	str = stripText(str);
	substr = stripText(substr);

	// Stop here if `substr` is longer than `str` (which means it's not a substring)
	if (str.length < substr.length) return levenshtein(str, substr);

	/**
	 * Searches `toSplit` and returns the best matching block
	 *
	 * #### Algorithm
	 * - If each half will be longer than, but not double, the length
	 *   of `toSearch`:
	 *   - compare all possible blocks of `toSplit` and return the best block.
	 * - Else:
	 *   - return the whole `toSplit` block.
	 * @param {string} toSplit
	 * @param {string} toSearch
	 * @returns {string}
	 */
	function chooseBestBlock(toSplit, toSearch) {
		const best = { text: "", dist: Infinity };

		// Create all possible substrings that are the same length
		// as `toSearch`, and find the best one out of them
		for (let i = 0; i <= toSplit.length - toSearch.length; i++) {
			const newText = toSplit.substring(i, i+toSearch.length);
			const newDist = levenshtein(newText, toSearch);

			if (newDist < best.dist) {
				best.text = newText;
				best.dist = newDist;
			}
		}

		// Return the substring that had the smallest levenshtein distance
		return best.text;
	}

	const bestBlock = chooseBestBlock(str, substr);
	const dist = levenshtein(bestBlock, substr);

	// Handle short but unrelated substrings (which naturally tend to have small lev distances)
	// by comparing them to the whole `str`, which will give a very big distance
	const similarityRatio = 1 - dist / substr.length;
	if (similarityRatio <= 0.5) return levenshtein(str, substr);

	return dist;
}

/** Returns an array of all the citations after a mishna
 * @param {segment[]} segments
 * @param {string} mishnaText
 * @returns {Promise<citation[]>}
 */
async function getCitations(segments, mishnaText) {
	const citations = [];

	for (let i = 0; i < segments.length; i++) {
		await updateProgress("citation", i+1, segments.length);

		const levDist = levSubstring(mishnaText, segments[i].text);
		if (levDist <= levMinMishna) {
			citations.push({
				...segments[i],
				inMiddleOfRow: false,
				inRow: 1,
				isPartOfRow: false,
				levFromNext: 9999, // Not using `Infinity` since JSON converts it to `null`
			});
		}
	}

	return citations;
}

/**
 * Searches a masechet for repeating citations
 * @param {string} masechet Text contents of a masechet
 * @returns {Promise<mishna[]>}
 */
async function query(masechet) {
	const mishnayot = getMishnayot(masechet);

	for (let i = 0; i < mishnayot.length; i++) {
		await updateProgress("mishna", i+1, mishnayot.length);

		const gemaraText = masechet.substring(mishnayot[i].end, mishnayot[i+1]?.start ?? masechet.length);
		const segments = getSegments(gemaraText);

		const citations = await getCitations(segments, mishnayot[i].text);
		mishnayot[i].citations.push(...citations);
	}

	/* Count citation repeats */
	for (const mishna of mishnayot) {
		const { citations } = mishna;

		for (let i = 0; i < citations.length; i++) {
			const current = citations[i];

			for (let j = i+1; j < citations.length; j++) { // Compare to subsequent citations
				const sorted = [current.text, citations[j].text]
					.map(str => stripText(str)) // Strip text
					.sort((a, b) => b.length - a.length); // Sort by length (longer one should appear first)
				const levDist = levenshtein(sorted[0], sorted[1]);

				if (j === i+1) current.levFromNext = levDist; // Only store distance from immediate neighbor

				if (levDist < levMinCitations) {
					current.inRow++;
					current.isPartOfRow = citations[j].isPartOfRow = true;
					citations[j].inMiddleOfRow = true;
				} else {
					break;
				}
			}
		}
	}

	return mishnayot.filter(mishna => mishna.citations.length > 0);
}

/**
 * Takes an array of mishnayot and it formatted as HTML code
 * @param {mishna[]} mishnayot
 * @param {boolean} printAll
 * @returns {string} HTML code that renders
 * to a list of the citations in this masechet
 */
function formatResults(mishnayot, printAll) {
	// Filter non-repeating citations
	let filtered = JSON.parse(JSON.stringify(mishnayot));

	if (!printAll) {
		for (const mishna of filtered) {
			mishna.citations = mishna.citations.filter(cit => cit.isPartOfRow);
		}
		filtered = filtered.filter(mishna => mishna.citations.length > 0);
	}

	let code = "";
	for (const mishna of filtered) {
		// List current mishna:
		code += `<p class="mishna-text`;
		if (mishna.citations.length === 0) code += ` no-row`;
		code += `">${mishna.text}</p><ul>`;

		// List citations:
		for (const citation of mishna.citations) {
			if (citation.inMiddleOfRow) {
				code += `<li class="unlisted"><ul><li class="talmud-text">${citation.text}`;
			} else if (citation.inRow === 1) {
				code +=
					`<li class="unlisted no-row">הציטטה הבאה מופיעה פעם אחת:
						<ul><li class="talmud-text">${citation.text}`;
			} else {
				code +=
					`<li class="unlisted">הציטטה הבאה מופיעה ${`${citation.inRow} פעמים`}:
						<ul><li class="talmud-text">${citation.text}`;
			}

			if (citation.levFromNext < 9999) {
				code += ` <span class="unlisted">(מרחק מהבא: ${citation.levFromNext})</span>`;
			}

			code += `</li></ul></li>`;
		}

		code += "</ul>";
	}

	return code;
}

let resultsCache = [];

function renderResults() {
	const printAll = $("#hide").text() === "הסתר ציטוטים לא רצופים";

	let code = "";
	for (const masechet of resultsCache) {
		code +=
			`<div id="${masechet[0]}" class="masechet"><h3>${talmud.masechetName(masechet[0])}</h3>` +
			formatResults(masechet[1], printAll) + "</div>";
	}
	$("#results").empty();
	$("#results").append(code);

	printAll ?
		$("#hide").text("הצג ציטוטים לא רצופים") :
		$("#hide").text("הסתר ציטוטים לא רצופים");
}

async function searchClicked() {
	const startTime = performance.now();

	$("#results").css({display: "none"});
	$("#hide").hide();

	const masechtot = Object.entries(await talmud.getTalmud());

	for (let i = 0; i < masechtot.length; i++) {
		resultsCache[i] = [masechtot[i][0], []];
		resultsCache[i][1] = await query(masechtot[i][1]);

		await updateProgress("masechet", i+1, masechtot.length);
	}
	renderResults();

	$("#hide").show();
	$("#results").css({display: "flex"});

	console.log("Search took", performance.now() - startTime, "milliseconds");
}

$("#search").on("click", searchClicked);

$("#hide").on("click", renderResults);
