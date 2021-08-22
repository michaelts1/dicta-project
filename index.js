import { levenshtein, talmud, updateProgress } from "./modules.js";
import { argv } from "process";
import { performance } from "perf_hooks";
import jsonfile from "jsonfile";

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
 * @property {boolean} isPartOfRow
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
 * @returns {citation[]}
 */
function getCitations(segments, mishnaText) {
	const citations = [];

	for (let i = 0; i < segments.length; i++) {
		updateProgress("citation", i+1, segments.length);

		const levDist = levSubstring(mishnaText, segments[i].text);
		if (levDist <= levMinMishna) {
			citations.push({
				...segments[i],
				levFromNext: 9999, // Not using `Infinity` since JSON doesn't support it
				isPartOfRow: false,
			});
		}
	}

	return citations;
}

/**
 * Searches a masechet for repeating citations
 * @param {string} masechet Text contents of a masechet
 * @param {boolean} printAll If false, omits mishnayot without repeating citations
 * @returns {mishna[]}
 */
function query(masechet, printAll) {
	const mishnayot = getMishnayot(masechet);

	for (let i = 0; i < mishnayot.length; i++) {
		updateProgress("mishna", i+1, mishnayot.length);

		const gemaraText = masechet.substring(mishnayot[i].end, mishnayot[i+1]?.start ?? masechet.length);
		const segments = getSegments(gemaraText);

		const citations = getCitations(segments, mishnayot[i].text);
		mishnayot[i].citations.push(...citations);
	}

	/* Count citation repeats */
	for (const mishna of mishnayot) {
		const { citations } = mishna;

		for (let i = 0; i < citations.length; i++) {
			const current = citations[i];

			// Compare to subsequent citations
			for (let j = i+1; j < citations.length; j++) {
				const sorted = [current.text, citations[j].text]
					.map(str => stripText(str)) // Strip text
					.sort((a, b) => b.length - a.length); // Sort by length (longer one should appear first)
				const levDist = levenshtein(sorted[0], sorted[1]);

				if (j === i+1) current.levFromNext = levDist; // Only store distance from immediate neighbor

				if (levDist < levMinCitations) {
					current.isPartOfRow = citations[j].isPartOfRow = true;
				} else {
					break;
				}
			}
		}

		// Keep only repeating citations if `printAll` is false
		if (!printAll) mishna.citations = mishna.citations.filter(cit => cit.isPartOfRow);
	}

	// Only return mishnayot with citations
	return mishnayot.filter(mishna => mishna.citations.length > 0);
}

async function search() {
	const startTime = performance.now();
	const printAll = argv.includes("-a");
	const masechtot = Object.entries(await talmud.getTalmud());

	let result = {};
	for (let i = 0; i < masechtot.length; i++) {
		result[masechtot[i][0]] = query(masechtot[i][1], printAll);
		updateProgress("masechet", i+1, masechtot.length);
	}
	jsonfile.writeFile("lastResult.json", result, { spaces: 2 });

	console.log(printAll ?
		"Citations have been logged to './lastResult.json'" :
		`Repeating citations have been logged to './lastResult.json.
To include all citations, pass -a to the program.`);
	console.log("\nSearch took", performance.now() - startTime, "milliseconds");
}

search();
