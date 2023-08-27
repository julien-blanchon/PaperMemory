window.onload = async function () {
    const prefs = global.state.prefs;
    let ignoreSources = (await getStorage("ignoreSources")) ?? {};

    const paperElements = document.getElementsByClassName("gs_or_ggsm");
    console.log(paperElements);

    const handleClick = (is, paperUrl, prefs) => (clickEvent) => {
        update = addOrUpdatePaper({
            url: paperUrl,
            is: is,
            prefs: prefs,
            store: true,
            // contentScriptCallbacks: paperUpdateDoneCallbacks,
        });
        console.log("click");
        console.log(paperUrl);
    };

    for (let i = 0; i < paperElements.length; i++) {
        let paperElement = paperElements[i];
        const paperUrl =
            paperElement.parentElement.parentElement.parentElement.getElementsByClassName(
                "gs_rt"
            )[0].lastChild.href;
        //paperElement.lastChild.href;
        let parentElement = paperElement.parentNode;

        let isValidURL = await isSourceURL(paperUrl, true);
        console.log(isValidURL);
        if (!isValidURL) continue;

        const id = await parseIdFromUrl(paperUrl);
        let is = await isPaper(paperUrl, true);
        const paperExists = global.state.papers.hasOwnProperty(id);

        console.log(id);

        let button = document.createElement("button");
        button.className = "papermemory_btn";
        if (paperExists) {
            console.log("exist");
            button.className = "papermemory_btn_exist";
        }

        if (id) {
            console.log("addEventListener for");
            console.log(paperUrl);
            const myListener = handleClick(is, paperUrl, prefs);
            button.addEventListener(
                "click",
                myListener
                // () => makePaper(is, paperUrl)
                // () =>
                //    addOrUpdatePaper(
                //         paperUrl,
                //         is,
                //         prefs,
                //         true
                //         // contentScriptCallbacks: paperUpdateDoneCallbacks, //TODO: Add done callback animation
                //     )
                // console.log("add")
            );
        }
        button.innerHTML = "PaperMemory";
        console.log(button);
        parentElement.appendChild(button);
    }
};

// const paperElements = document.getElementsByClassName("gs_or_ggsm");

// for (let i = 0; i < paperElements.length; i++) {
//     let paperElement = paperElements[i];
//     let parentElement = paperElement.parentNode;

//     let button = document.createElement("button");
//     button.className = "papermemory_btn";
//     button.innerHTML = "PaperMemory";
//     parentElement.appendChild(button);
// }
