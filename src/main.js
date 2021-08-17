import { getMasechet, levenshtein } from "./modules.js";

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
 * @property {number} levFromNext
 */
/**
 * @typedef {Object} mishna
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {citation[]} citations
 */

/**
 * Shows progress to the user
 * @param {number} current Number of completed operations
 * @param {number} total Number of total operations
 */
function updateProgress(current, total) {
	if (current === total) {
		$("#results").empty();
	} else {
		$("#results").text(`סורק משניות... (${current} / ${total})`);
	}
}

/** Splits the masechet at every mishna
 * @param {string} masechet
 * @returns {mishna[]}
 */
function getMishnas(masechet) {
	const mishnas = [];

	// This regex was inspired by https://stackoverflow.com/a/8374980, and captures the next mishna
	const mishnaRegExp = new RegExp("(?:^|מתני׳)(?:.(?!גמ׳))+", "g");

	let execResult = null;
	while ((execResult = mishnaRegExp.exec(masechet)) !== null) {
		mishnas.push({
			start: execResult.index,
			end: execResult.index + execResult[0].length,
			text: execResult[0],
			citations: [],
		});
	}

	return mishnas;
}

/** Splits text from the gemara at every colon
 * @param {string} gemara
 * @returns {segment[]}
 */
function getSegments(gemara) {
	const colonRegExp = /:/g;
	const colonsIndexes = [];

	let execResult = null;
	while ((execResult = colonRegExp.exec(gemara)) !== null) {
		colonsIndexes.push(execResult.index);
	}

	const segments = [];

	// Store segments (ignore the last colon index)
	for (let i = 0; i < colonsIndexes.length-1; i++) {
		const indices = [
			colonsIndexes[i]+2, // Don't include the initial colon and space
			colonsIndexes[i+1]+1, // Include the final colon
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
	 *
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

	for (const segment of segments) {
		const levDist = levSubstring(mishnaText, segment.text);

		if (levDist <= levMinMishna) {
			citations.push({
				...segment,
				inRow: 1,
				isPartOfRow: false,
				levFromNext: Infinity,
			});
		}
	}

	return citations;
}

/**
 * Searches a masechet for repeating citations.
 * This function is async to allow the DOM to
 * redraw while it is running
 * @param {string} masechet
 */
async function query(masechet) {
	const mishnas = getMishnas(masechet);

	for (let i = 0; i < mishnas.length; i++) {
		const gemaraText = masechet.substring(mishnas[i].end, mishnas[i+1]?.start ?? masechet.length);
		const segments = getSegments(gemaraText);

		const citations = getCitations(segments, mishnas[i].text);
		mishnas[i].citations.push(...citations);

		// Output progress to the screen and give the browser time to render the new text
		updateProgress(i+1, mishnas.length);
		await new Promise(resolve => setTimeout(resolve));
	}

	/* Count citation repeats */
	for (const mishna of mishnas) {
		const cits = mishna.citations;

		for (let i = 0; i < cits.length; i++) {
			const cit = cits[i];

			for (let j = i+1; j < cits.length; j++) { // Compare to subsequent citations
				const sorted = [cit.text, cits[j].text]
					.map(str => stripText(str)) // Strip text
					.sort((a, b) => b.length - a.length); // Sort by length (longer one should appear first)
				const levDist = levenshtein(sorted[0], sorted[1]);

				if (j === i+1) cit.levFromNext = levDist; // Only store distance from immediate neighbor

				if (levDist < levMinCitations) {
					cit.inRow++;
					cits[j].isPartOfRow = true;
				} else {
					break;
				}
			}
		}
	}

	/* Output results */
	let code = "";
	for (const mishna of mishnas) {
		// List current mishna:
		code += `<p class="mishna-text`;

		if (mishna.citations.filter(c => c.isPartOfRow).length === 0) {
			code += " no-row";
		}

		code += `">${mishna.text}</p><ul>`;

		// List citations, if there are any:
		if (mishna.citations.length > 0) {
			for (const citation of mishna.citations) {
				if (citation.isPartOfRow) {
					code += `<li class="unlisted"><ul><li class="talmud-text">${citation.text}`;
				} else {
					if (citation.inRow === 1) {
						code +=
							`<li class="unlisted no-row">הציטטה הבאה מופיעה פעם אחת:
								<ul><li class="talmud-text">${citation.text}`;
					} else {
						code +=
							`<li class="unlisted">הציטטה הבאה מופיעה ${`${citation.inRow} פעמים`}:
								<ul><li class="talmud-text">${citation.text}`;
					}
				}

				if (citation.levFromNext < Infinity) {
					code += ` <span class="unlisted">(מרחק מהבא: ${citation.levFromNext})</span>`;
				}

				code += `</li></ul></li>`;
			}
		} else {
			code += `<li class="unlisted no-row">אין ציטטות בין משנה זו למשנה הבאה</li>`;
		}
		code += "</ul>";
	}
	$("#results").append(code);
}

function searchClicked() {
	const startTime = performance.now();
	$("#results").empty();
	$("#hide").hide();

	getMasechet("Nezikin", "Bava Batra").then(async masechet => {
		await query(masechet);

		$("#hide").text("הסתר ציטוטים לא רצופים");
		$("#hide").show();

		console.log("Search took", performance.now() - startTime, "milliseconds");
	}, reason => {
		alert("החיפוש נכשל:\n" + reason);
	});
}

$("#search").on("click", searchClicked);

$("#hide").on("click", () => {
	$("#hide").text() === "הצג ציטוטים לא רצופים" ?
		$("#hide").text("הסתר ציטוטים לא רצופים") :
		$("#hide").text("הצג ציטוטים לא רצופים");
	$(".no-row").toggle();
});
