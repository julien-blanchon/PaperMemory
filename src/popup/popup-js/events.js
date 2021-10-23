const addEventToClass = (className, eventName, fn) => {
    document.querySelectorAll(className).forEach((el) => {
        el.addEventListener(eventName, fn);
    });
};

const handleBackToFocus = (e) => {
    const id = eventId(e);
    setTimeout(() => {
        document
            .getElementById(`memory-container--${id}`)
            .dispatchEvent(new Event("focus"));
    }, 250);
};

const handleDeleteItem = (e) => {
    const id = eventId(e);
    showConfirmDeleteModal(id);
};

const handleOpenItemLink = (e) => {
    const id = eventId(e);
    focusExistingOrCreateNewPaperTab(global.state.papers[id]);
};

const handleOpenItemCodeLink = (e) => {
    const id = eventId(e);
    const url = global.state.papers[id].codeLink;
    focusExistingOrCreateNewCodeTab(url);
};

const handleCopyMarkdownLink = (e) => {
    const id = eventId(e);
    const md = global.state.papers[id].md;
    copyAndConfirmMemoryItem(id, md, "Markdown link copied!");
};

const handleCopyBibtex = (e) => {
    const id = eventId(e);
    const bibtext = global.state.papers[id].bibtext;
    copyAndConfirmMemoryItem(id, bibtext, "Bibtex copied!");
};

const handleCopyPDFLink = (e) => {
    const id = eventId(e);
    const pdfLink = global.state.papers[id].pdfLink;
    copyAndConfirmMemoryItem(id, pdfLink, "Pdf link copied!");
};

const handleAddItemToFavorites = (e) => {
    const id = eventId(e);
    const isFavorite = hasClass(`memory-container--${id}`, "favorite");
    saveFavoriteItem(id, !isFavorite);
};

const handleTextareaFocus = () => {
    var that = this;
    textareaFocusEnd(that);
};

const handleEditPaperFormSubmit = (e) => {
    e.preventDefault();

    // Get content
    const id = eventId(e);
    const { note, codeLink } = getPaperEdits(id);

    // Update metadata
    saveNote(id, note);
    saveCodeLink(id, codeLink);
    updatePaperTags(id, "memory-item-tags");

    // Close edit form
    dispatch(findEl(id, "memory-item-edit"), "click");
    findEl(id, "memory-item-save-edits").disabled = true;
};

const handleCancelPaperEdit = (e) => {
    e.preventDefault();
    const id = eventId(e);
    const paper = global.state.papers[id];
    val(findEl(id, "form-note-textarea"), paper.note);
    setHTMLEl(findEl(id, "memory-item-tags"), getTagsOptions(paper));
    dispatch(findEl(id, "memory-item-edit"), "click");
    findEl(id, "memory-item-save-edits").disabled = true;
};

const handleTogglePaperEdit = (e) => {
    e.preventDefault();
    // find elements
    const id = eventId(e);
    const container = document.getElementById(`memory-container--${id}`);
    const codeAndNote = $(findEl(id, "code-and-note"));
    const editPaper = $(findEl(id, "extended-item"));
    const tagList = $(findEl(id, "tag-list"));
    const tagEdit = $(findEl(id, "edit-tags"));
    const tagSelect = $(findEl(id, "memory-item-tags"));
    const actions = $(findEl(id, "memory-item-actions"));

    if (hasClass(container, "expand-open")) {
        // The edit form is open
        container.classList.remove("expand-open");
        // Open display elements
        codeAndNote.slideDown(250);
        tagList.slideDown(250);
        actions.slideDown(250);
        // Close inputs
        editPaper.slideUp(250);
        tagEdit.slideUp(250);
        // destroy to enable options update in HTML
        tagSelect.select2("destroy");
    } else {
        // The edit form is closed
        addClass(container, "expand-open");
        // Enable select2 tags input
        tagSelect.select2({
            ...global.select2Options,
            width: "75%",
        });
        if (!hasClass(container, "has-monitoring")) {
            // only listen for changes once
            tagSelect.on("change", monitorPaperEdits(id, false));
        }
        // monitorPaperEdits listener has been added
        container.classList.add("has-monitoring");
        // Close display elements
        codeAndNote.slideUp(250);
        tagList.slideUp(250);
        actions.slideUp(250);
        // Show form
        editPaper.slideDown(250);
        tagEdit.slideDown(250);
    }
};

const handleMemorySelectChange = (e) => {
    const sort = e.target.value;
    global.state.sortKey = sort;
    sortMemory();
    displayMemoryTable();
    setMemorySortArrow("down");
};

const handleMemorySortArrow = (e) => {
    if (
        document.querySelector("#memory-sort-arrow svg").id === "memory-sort-arrow-down"
    ) {
        setMemorySortArrow("up");
    } else {
        setMemorySortArrow("down");
    }
    reverseMemory();
    displayMemoryTable();
};

const handleFilterFavorites = () => {
    const showFavorites = !global.state.showFavorites;
    global.state.showFavorites = showFavorites;
    if (showFavorites) {
        addClass(
            document.getElementById("filter-favorites").querySelector("svg"),
            "favorite"
        );
        sortMemory();
        global.state.papersList = global.state.papersList.filter((p) => p.favorite);
        displayMemoryTable();
        setMemorySortArrow("down");
        document.getElementById(
            "memory-select"
        ).innerHTML += `<option value="favoriteDate">Last favoured</option>`;
        const n = global.state.papersList.length;
        setPlaceholder("memory-search", `Search ${n} entries...`);
    } else {
        removeClass(
            document.getElementById("filter-favorites").querySelector("svg"),
            "favorite"
        );

        if (document.getElementById("memory-select").value === "favoriteDate") {
            document.getElementById("memory-select").value = "lastOpenDate";
            global.state.sortKey = "lastOpenDate";
        }
        document.querySelector(`#memory-select option[value="favoriteDate"]`).remove();
        sortMemory();
        setMemorySortArrow("down");

        if (val("memory-search").trim()) {
            dispatch("memory-search", "keypress");
        } else {
            global.state.papersList = global.state.sortedPapers;
            displayMemoryTable();
        }
        const n = global.state.sortedPapers.length;
        setPlaceholder("memory-search", `Search ${n} entries...`);
    }
};

const handleMemorySearchKeyPress = (allowEmptySearch) => (e) => {
    // read input, return if empty (after trim)
    const query = val("memory-search").trim();
    if (!query && !allowEmptySearch && e.key !== "Backspace") return;

    if (query.startsWith("t:")) {
        // look into tags
        filterMemoryByTags(query);
    } else if (query.startsWith("c:")) {
        // look into code links
        filterMemoryByCode(query);
    } else {
        // look into title & authors & notes & conf
        filterMemoryByString(query);
    }
    // display filtered papers
    displayMemoryTable();
};

const handleMemorySearchKeyUp = (e) => {
    // keyup because keypress does not listen to backspaces
    if (e.key == "Backspace") {
        var backspaceEvent = new Event("keypress");
        backspaceEvent.key = "Backspace";
        dispatch("memory-search", backspaceEvent);
    }
};

const handleCancelModalClick = () => {
    document.getElementById("confirm-modal").remove();
    addListener("memory-switch", "click", handleMemorySwitchClick);
};

const handleConfirmDeleteModalClick = (e) => {
    const id = e.target.id.split("--")[1];
    const title = global.state.papers[id].title;
    delete global.state.papers[id];
    chrome.storage.local.set({ papers: global.state.papers }, () => {
        global.state.papersList = Object.values(cleanPapers(global.state.papers));
        sortMemory();
        displayMemoryTable();
        document.getElementById("confirm-modal").remove();
        console.log(`Successfully deleted "${title}" (${id}) from ArxivMemory`);
        if (global.state.currentId === id) {
            updatePopupPaperNoMemory();
        }
        setPlaceholder(
            "memory-search",
            `Search ${global.state.papersList.length} entries ...`
        );
        addListener("memory-switch", "click", handleMemorySwitchClick);
    });
};

const handleTagClick = (e) => {
    const tagEl = e.target;
    const query = tagEl.textContent;
    val("memory-search", `t: ${query}`);
    dispatch("memory-search", "keypress");
};

const handleClearSearch = (e) => {
    if (e.target.value === "") {
        dispatch("memory-search", "clear-search");
    }
};

const handleMemorySwitchClick = () => {
    global.state.memoryIsOpen ? closeMemory() : openMemory();
};

const handlePopupKeydown = (e) => {
    const key = e.key;
    if (["Backspace", "Enter", "Escape", "a", "e"].indexOf(key) < 0) {
        return;
    }

    if (global.state.menuIsOpen) {
        if (key === "Escape") {
            // escape closes menu
            e.preventDefault();
            closeMenu();
        }
        return;
    }

    if (!global.state.memoryIsOpen) {
        if (key === "a") {
            // a opens the arxiv memory
            const focused = document.querySelectorAll(":focus");
            if (focused && focused.length) {
                if (Array.from(focused).some((el) => hasClass(el, "noMemoryOnA"))) {
                    return;
                }
            }
            dispatch("memory-switch", "click");
        } else if (key === "Enter") {
            // enter on the arxiv memory button opens it
            let el = document.querySelector("#memory-switch-text-on:focus");
            if (el) {
                dispatch("memory-switch", "click");
                return;
            }
            // enter on the menu button opens it
            el = document.querySelector("#tabler-menu:focus");
            if (el) {
                dispatch("tabler-menu", "click");
                dispatch("tabler-menu", "blur");
                return;
            }
        }
        return;
    }

    // Now memory is open

    if (key === "Enter") {
        // enable Enter on favorites and sort arrows
        const favoriteBtn = document.querySelector("#filter-favorites:focus");
        if (favoriteBtn) {
            dispatch("filter-favorites", "click");
            return;
        }
        const arrowBtn = document.querySelector("#memory-sort-arrow:focus");
        if (arrowBtn && key === "Enter") {
            dispatch("memory-sort-arrow", "click");
            return;
        }
    }

    let id;
    const paperItem = document.querySelector(".memory-container:focus");
    if (key !== "Escape") {
        if (!paperItem) return;
        id = paperItem.id.split("--")[1];
    }

    if (key === "Backspace") {
        // delete
        dispatch(findEl(id, "memory-delete"), "click");
    } else if (key === "Enter") {
        // open paper
        dispatch(findEl(id, "memory-item-link"), "click");
    } else if (key === "Escape") {
        // close memory
        e.preventDefault();
        if (paperItem && hasClass(paperItem, "expand-open")) {
            handleTogglePaperEdit(e);
        } else {
            closeMemory();
        }
    } else if (key === "e") {
        // edit item
        dispatch(findEl(id, "memory-item-edit"), "click");
    }
};
