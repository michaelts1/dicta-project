import { pad, getMasechet/*, levenshtein*/ } from "./modules.js";

const mishnaKey = "מתני׳";

function query(masechet, searchQuery) {
	/* Find the mishna that contains the query */

	/* This regex was inspired by https://stackoverflow.com/a/8374980,
		and captures the last mishna that contains the search query		*/
	const firstMishnaRegExp = new RegExp(mishnaKey + "(?:[^:](?!" + mishnaKey + "))+?" + searchQuery + "[^:]*?:");
	const firstMishna = masechet.match(firstMishnaRegExp);

	if (firstMishna === null) {
		$("#results-count-total, #results-count-consecutive").text(0);
		$("#results-container").show();
		$("#results").append(`<li style="display: block;">הביטוי שהזנת לא נמצא במשנה</li>`);
		return;
	}

	const endOfFirstMishna = firstMishna.index + firstMishna[0].length;
	let startOfNextMishna = masechet.indexOf(" " + mishnaKey, endOfFirstMishna);
	if (startOfNextMishna === -1) startOfNextMishna = masechet.length;

	masechet = masechet.substring(firstMishna.index, startOfNextMishna);

	/* Split the masechet at every colon and store all segments */
	const colonRegExp = /:/g;
	const colonsIndexes = [];

	let execResult = null;
	while ((execResult = colonRegExp.exec(masechet)) !== null) {
		colonsIndexes.push(execResult.index);
	}

	const segments = [];
	const mishna = masechet.substring(0, colonsIndexes[0]);

	// Store segments (ignore the last colon index)
	for (let i = 0; i < colonsIndexes.length-1; i++) {
		const indexes = [colonsIndexes[i], colonsIndexes[i + 1]];
		segments.push({
			indexes,
			result: masechet.substring(...indexes),
		});
	}

	/* Compare each segment to the original mishna */
	const citations = [];
	for (const segment of segments) {
		const strippedText = segment.result
			.replace(/^: ו?/, "")
			.replace(/ וכו'\s*:?$/, "");

		if (mishna.indexOf(strippedText) !== -1) citations.push(segment);
	}

	/* Find consecutive citations that contain the query */
	for (const citation of citations) {
		citation.isWanted = citation.result.indexOf(searchQuery) !== -1;
	}

	let maxConsecutive = 0;
	for (let i = 0, consecutive = 0; i < citations.length; i++) {
		if (citations[i].isWanted) {
			consecutive++;
		} else {
			consecutive = 0;
		}

		if (consecutive > maxConsecutive) {
			maxConsecutive = consecutive;
		}
	}

	/* Output results */
	for (const citation of citations) {
		// Wrap the citation with some of the text before and after it:
		let text = masechet
			.substring(citation.indexes[0] - 50, citation.indexes[1] + 50);

		if (citation.isWanted) {
			text = text.split(searchQuery);
			text = pad(text[0], `<strong>${searchQuery}</strong>`, text[1], 40);
		} else {
			text = text.split(":");
			text = pad(text[0] + ":", text[1] + ":", text[2], 40);
		}

		$("#results").append(`<li class=${citation.isWanted ? "wanted" : "unwanted"}>${text}</li>`);
	}

	if (citations.filter(citation => citation.isWanted).length === 0) {
		$("#results").append(`<li style="display: block;">
			הביטוי שהזנת לא צוטט בגמרא לאחר המשנה שמתחילה במילים
			"${pad("", "", mishna, 50)}"
		</li>`);
	}

	$("#results-count-total").text($(".wanted").length);
	$("#results-count-consecutive").text(maxConsecutive);

	$("#results-container").show();
}

function searchClicked() {
	$("#results").empty();
	$("#results-container").hide();

	const searchQuery = $("#search-text").val().replace(/\s+/g, " ");
	if (searchQuery.length < 4) {
		window.alert("הביטוי חייב להכיל לפחות 4 תווים");
		return;
	}

	getMasechet("Nezikin", "Bava Batra").then(value => {
		query(value, searchQuery);
	}, reason => {
		alert("החיפוש נכשל.\n", reason);
	});
}

$("#search-button").click(searchClicked);
$("#search-text").on("keypress", event => { // Treat ctrl+enter as click
	if (event.keyCode === 13 && event.ctrlKey) {
		searchClicked();
	}
});

$("#show-unwanted").click(()=>{
	$(".unwanted").css("display", "list-item");
});
