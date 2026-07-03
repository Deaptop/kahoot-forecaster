// ==UserScript==
// @name         Kahoot Forecaster
// @version      1.0
// @description  See all Kahoot quiz answers instantly
// @author       Deaptop
// @match        https://kahoot.it/*
// @grant        GM_xmlhttpRequest
// @connect      create.kahoot.it
// ==/UserScript==

(function () {
    'use strict';

    let savedValue = "";
    let last_question = -1;
    let data = null;
    let listenerStarted = false;


    const style = document.createElement("style");
    style.textContent = `

    #kahoot-panel {
        position: fixed;
        top: 100px;
        right: 100px;
        background: rgba(20,20,20,0.75); /* transparent */
        backdrop-filter: blur(10px); /* blurred */
        color: white;
        font-family: Arial;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 10px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
    }

    .k-row {
        display: flex;
        gap: 6px;
    }

    .k-input {
        flex: 1;
        padding: 6px;
        border-radius: 6px;
        border: none;
        outline: none;
    }

    .k-button {
        padding: 6px 10px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        background: #4caf50;
        color: white;
    }

    .k-button:hover {
        background: #45a049;
    }
    .k-button:active {
        transform: scale(0.96);
    }

    .k-title {
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 8px;
    }

    .k-status {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 6px;
        color: red;
    }

    .k-output {
        margin-top: 8px;
        font-size: 12px;
        padding: 6px;
        background: rgba(255,255,255,0.08);
        border-radius: 6px;
        min-height: 20px;
    }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "kahoot-panel";
    panel.style.zIndex = "999999"; //render above all
    panel.style.position = "fixed";
    panel.style.pointerEvents = "auto";
    panel.style.isolation = "isolate";
    panel.style.transform = "translateZ(0)";

    const header = document.createElement("div");
    header.className = "k-title";
    header.innerText = "Kahoot Forecaster";

    const row = document.createElement("div");
    row.className = "k-row";

    const input = document.createElement("input");
    input.className = "k-input";
    input.placeholder = "Enter host URL or quiz ID...";

    const run_button = document.createElement("button");
    run_button.className = "k-button";
    run_button.innerText = "Run";

    const status = document.createElement("div");
    status.className = "k-status";
    status.innerText = "Disabled";

    const output = document.createElement("div");
    output.className = "k-output";
    output.innerText = "Waiting...";

    row.appendChild(input);
    row.appendChild(run_button);

    panel.appendChild(header);
    panel.appendChild(row);
    panel.appendChild(status);
    panel.appendChild(output);


    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.style.cursor = "move"; //drag cursor
    panel.style.userSelect = "none"; //prevent text selection
    panel.style.webkitUserSelect = "none";


    //dragging logic
    header.addEventListener("mousedown", (e) => {
        isDragging = true;

        const rect = panel.getBoundingClientRect();

        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        panel.style.transition = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        // panel.style.left = `${e.clientX - offsetX}px`;
        // panel.style.top = `${e.clientY - offsetY}px`;

        const rect = panel.getBoundingClientRect();
        const pos_offset = 10;

        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(pos_offset, Math.min(left, window.innerWidth - rect.width - pos_offset));
        top = Math.max(pos_offset, Math.min(top, window.innerHeight - rect.height - pos_offset));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;

        panel.style.right = "auto";
        panel.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => {
        isDragging = false;
    });




    //handle submit
    run_button.addEventListener("click", () => {
        savedValue = input.value;

        loadData(savedValue, (r) => { //fetch answers
            switch (r) {
                case 1:
                    output.innerText = `Load successful [${data.title}]`;
                    output.style.color = "white";

                    startListener();
                    status.innerText = "Enabled";
                    status.style.color = "green";
                    break;
                case 0:
                    output.innerText = "Request failed";
                    output.style.color = "orange";
                    status.innerText = "Disabled";
                    status.style.color = "red";
                    stopListener();
                    break;
                case 9:
                    output.innerText = "Invalid URL: " + savedValue;
                    output.style.color = "orange";
                    status.innerText = "Disabled";
                    status.style.color = "red";
                    stopListener();
                    break;
            }
        });
    });

    function loadData(quizID, callback) {
        // if(!savedValue.startsWith("https://create.kahoot.it/rest/kahoots/")) {
        //     callback(9) //invalid URL
        //     return;
        // }

        if(quizID.startsWith("https://")) {
            if(!quizID.startsWith("https://create.kahoot.it/rest/kahoots/")) {
                callback(9) //invalid URL
                return;
            }
        } else {
            quizID = "https://create.kahoot.it/rest/kahoots/" + quizID;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: quizID, //submitted URL

            onload: function (response) {
                try {
                    data = JSON.parse(response.responseText);
                    console.log("Kahoot data:", data); //successful response

                    if(!data.quizType) { //if quiz ID is invalid
                        callback(9);
                        return;
                    }

                    callback(1);
                    return;

                } catch (e) {
                    console.log("Raw response:", response.responseText);
                    callback(0); //wrong ID
                    return;
                }
            },

            onerror: function (err) {
                console.error("Request failed:", err);
                callback(0); //request failed
                return;
            }
        });
    }

    let lastSeen = null;
    let observer = null;
    function waitForElement(selector, callback) {
        observer = new MutationObserver(() => { //wait for the element to change
            const el = document.querySelector(selector);

            if (el && el !== lastSeen) { //if exists and not repeated
                lastSeen = el;
                callback(el); //show answers
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    function stopListener() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        listenerStarted = false;
    }

    function startListener() {
        if (listenerStarted) return; //don't start listener again
        listenerStarted = true;


        if(document.querySelector("[class^='question__PageMainContent']")) { //if right now on question page (reloaded)
            showAnswers();
        }

        waitForElement("[class^='question__PageMainContent']", (el) => { //wait for question page
           showAnswers()
        });
    }

    function showAnswers(){
        //layout__Container-sc-
        //layout__Row-sc-
        //standard__CardButtonWrapper-sc-
        //question__PageWrapper-sc-

        const index_counter = document.querySelector("[data-functional-selector='question-index-counter']"); //scrape question number

        if(!index_counter) return; //return if no element dound

        const question = index_counter.textContent;
        console.log("Question number " + question);

        if (question === last_question) return; //don't try to answer question again
        last_question = question;


        let question_data = data.questions[question - 1]
        if (!data?.questions?.[question - 1]) return;

        let type = question_data.type;
        console.log(type)

        switch (type) {
            case "survey":
            case "quiz":
            case "multiple_select_quiz":
                question_data.choices.forEach((choice, number) => { // for each choice from list
                    let correct = choice.correct //decide if correct
                    let button = document.querySelector(`[data-functional-selector='answer-${number}']`);

                    if (!button) return;

                    if(correct) {
                        button.style.backgroundColor = "green"; //green if correct
                    } else {
                        button.style.backgroundColor = "red";
                    }
                });

                break;
            case "jumble": {

                const instructions = document.querySelector("[class^='standard__Instructions']");
                let ans = null;

                if(!instructions) break;

                if(question_data.choices[0].answer) {
                    ans = question_data.choices
                        .map(choice => `"${choice.answer}"`)
                        .join(" \n-> "); //if text responses
                } else {
                    ans = question_data.choices
                        .map(choice => `"${choice.image.altText}"`)
                        .join(" \n-> "); //if image responses
                }

                instructions.textContent = ans; //display instructions
                instructions.style.backgroundColor = "green";
                instructions.style.fontSize = "24px";
                instructions.style.whiteSpace = "pre-line";
                instructions.style.textAlign = "left";

                break;
            }
            case "open_ended": {

                const instructions = document.querySelector("[data-functional-selector='text-input-info-text']");

                if(!instructions) break;

                const ans = question_data.choices
                .map(choice => `"${choice.answer}"`)
                .join(", ");


                instructions.textContent = ans; //display instructions
                instructions.style.backgroundColor = "green";
                instructions.style.fontSize = "24px";

                break;

            }
        }
    }



    row.appendChild(input);
    row.appendChild(run_button);

    panel.appendChild(header);
    panel.appendChild(row);
    panel.appendChild(status);
    panel.appendChild(output);

    document.documentElement.appendChild(panel);

})();