function delay(fn, ms) {
    // https://stackoverflow.com/questions/1909441/how-to-delay-the-keyup-handler-until-the-user-stops-typing
    let timer = 0
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(fn.bind(this, ...args), ms || 0)
    }
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}
function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}

function parseUrl(url) {
    var a = document.createElement('a');
    a.href = url;
    return a;
}

const downloadTextFile = (content, fileName, contentType) => {
    var a = document.createElement("a");
    var file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

var state = {
    menuIsOpen: false,
    memoryIsOpen: false,
    htmlPapers: [],
    papers: {},
    papersList: [],
    sortedPapers: [],
    sortKey: "",
};

const arxiv = id => {
    $.get("https://export.arxiv.org/api/query?id_list=" + id).done(
        xml => {
            xml = $(xml);
            const title = xml.find("entry title").text();
            let authors = [];
            xml.find("entry author name").each((i, a) => authors.push(a.textContent));
            const cite = authors[0].split(" ")[0] + year + title.split(" ")[0];
            const template = `@misc{${cite},
                title={${title}},
                author={${authors.join(" and ")}},
                year={${year}},
                eprint={${id}},
                archivePrefix={arXiv},
                primaryClass={cs.CY}
            }`

        }
    )
}

const closeMenu = () => {
    $("#menuDiv").slideUp({
        duration: 500,
        easing: "easeOutQuint"
    }) && $("#tabler-menu").fadeOut(() => {
        $("#tabler-menu").html(`
                <svg class="tabler-icon">
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-adjustments" />
                </svg>
            `);
        $("#tabler-menu").fadeIn()
    })
}

const openMenu = () => {
    $("#menuDiv").slideDown({
        duration: 500,
        easing: "easeOutQuint"
    }) && $("#tabler-menu").fadeOut(() => {
        $("#tabler-menu").html(`
        <svg class="tabler-icon menu-svg">
            <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-circle-x" />
        </svg>
    `);
        $("#tabler-menu").fadeIn()
    })
}

const focusExistingOrCreateNewTab = (paperUrl, arxivId) => {
    chrome.tabs.query({ url: "https://arxiv.org/*" }, (tabs) => {
        let validTabsIds = [];
        let pdfTabsIds = [];
        const urls = tabs.map(t => t.url)
        let idx = 0;
        for (const u of urls) {
            if (u.indexOf(arxivId) >= 0) {
                validTabsIds.push(idx)
                if (u.indexOf(".pdf") >= 0) {
                    pdfTabsIds.push(idx)
                }
            }
            idx += 1
        }
        if (validTabsIds.length > 0) {
            let tabId = 0
            if (pdfTabsIds.length > 0) {
                tabId = tabs[pdfTabsIds[0]].id
            } else {
                tabId = tabs[validTabsIds[0]].id
            }
            var updateProperties = { 'active': true };
            chrome.tabs.update(tabId, updateProperties, (tab) => { });
        } else {
            chrome.tabs.create({ url: paperUrl }, (tab) => { })
        }

    });
}

const orderPapers = (paper1, paper2) => {
    let val1 = paper1[state.sortKey];
    let val2 = paper2[state.sortKey];

    if (typeof val1 === "string") {
        val1 = val1.toLocaleLowerCase();
        val2 = val2.toLocaleLowerCase();
    }
    if (["addDate", "count", "lastOpenDate"].indexOf(state.sortKey) >= 0) {
        return val1 > val2 ? -1 : 1
    }
    return val1 > val2 ? 1 : -1
}

const sortMemory = () => {
    state.sortedPapers = Object.values(state.papers)
    state.sortedPapers.sort(orderPapers)
    state.papersList.sort(orderPapers);
}

const reverseMemory = () => {
    state.sortedPapers.reverse()
    state.papersList.reverse()
}

const filterMemory = (letters) => {
    let papersList = [];
    for (const paper of state.sortedPapers) {
        if (
            paper.title.toLowerCase().indexOf(letters) >= 0
            ||
            paper.author.toLowerCase().indexOf(letters) >= 0
        ) {
            papersList.push(paper)
        }
    }
    state.papersList = papersList;
}

const getMemoryItemHTML = (item) => {
    const addDate = (new Date(item.addDate)).toLocaleString().replace(",", "")
    const lastOpenDate = (new Date(item.lastOpenDate)).toLocaleString().replace(",", "")
    const displayId = item.arxivId.indexOf("_") < 0 ? item.arxivId : item.arxivId.split("_")[0];
    const note = item.hasOwnProperty("note") ? item.note : "[no note]";
    const id = item.arxivId;
    return `
    <div class="memory-item-container">

        <h4 class="memory-item-title" title="Added ${addDate}&#13;&#10;Last open ${lastOpenDate}">
            ${item.title}
        </h4>
        
        <small>${item.author}</small>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px">

        
            <div style="display: flex; align-items: center">
                <div
                    class="memory-item-expand memory-item-svg-div"
                    id="memory-item-expand-${id}"
                    title="Expand paper details"
                    style="margin-right: 3px"
                >
                    <svg  style="height: 15px; width: 15px; pointer-events: none;" >
                        <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-arrows-vertical" />
                    </svg>
                </div>
                <small>
                    ${displayId}
                </small>
            </div>

            <div
                class="memory-item-link memory-item-svg-div" 
                id="memory-item-link-${id}"
                title="Open ${item.pdfLink}" 
            >
                <svg  style="height: 15px; width: 15px; pointer-events: none;" >
                   <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-external-link" />
                </svg>
            </div>
                
            <div 
                class="memory-item-copy-link memory-item-svg-div"
                id="memory-item-copy-link-${id}"
                title="Copy pdf link" 
            >
                <svg style="height: 15px; width: 15px; pointer-events: none;" >
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-link" />
                </svg>
            </div>

            <div 
                class="memory-item-md memory-item-svg-div"
                id="memory-item-md-${id}"
                title="Copy Markdown-formatted link" 
            >
                <svg style="height: 15px; width: 15px; pointer-events: none;" >
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-clipboard-list" />
                </svg>
            </div>

            <span style="color: green; display: none" id="memory-item-feedback-${id}"></span>
            
            <div title="Number of times you have loaded&#13;&#10;the paper's Page or PDF">
                Visits: ${item.count}
            </div>

        </div>

        <div id="extended-item-${id}" class="extended-item" style="display: none">
            <div id="item-note-${id}">
                <p style="font-size: 0.8rem;">
                    <span id="note-content-${id}">${note}</span>
                    <span id="edit-note-item-${id}" class="edit-note-item">(edit)</span>
                </p>
                <form class="form-note" id="form-note-${id}" style="display: none">
                    <textarea style="width:98%" id="form-note-textarea-${id}">${note}</textarea>
                    <div class="form-note-buttons">
                        <button type="submit">Save</button>
                        <button class="cancel-note-form" id="cancel-note-form-${id}">Cancel</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="delete-memory-item" id="delete-memory-item-${id}"> - </div>
    </div>
    `
}

const makeMemoryTable = () => {
    state.htmlPapers = [];
    for (const paper of state.papersList) {
        state.htmlPapers.push(getMemoryItemHTML(paper))
    }
}

const displayMemoryTable = () => {
    $("#memory-table").html("");
    for (const html of state.htmlPapers) {
        $("#memory-table").append(html);
    }
    $(".delete-memory-item").click((e) => {
        const arxivId = e.target.id.replace("delete-memory-item-", "");
        confirmDelete(arxivId)
    })
    $(".memory-item-link").click((e) => {
        const arxivId = e.target.id.replace("memory-item-link-", "");
        const url = state.papers[arxivId].pdfLink;
        focusExistingOrCreateNewTab(url, arxivId)
    })
    $(".memory-item-md").click((e) => {
        const arxivId = e.target.id.replace("memory-item-md-", "");
        const md = state.papers[arxivId].md;
        copyAndConfirmMemoryItem(arxivId, md, "Markdown Link Copied!")
    })
    $(".memory-item-copy-link").click((e) => {
        const arxivId = e.target.id.replace("memory-item-copy-link-", "");
        const pdfLink = state.papers[arxivId].pdfLink;
        copyAndConfirmMemoryItem(arxivId, pdfLink, "Pdf Link Copied!")
    })
    $(".form-note").submit((e) => {
        e.preventDefault();
        const id = e.target.id.replace("form-note-", "");
        const note = $(`#form-note-textarea-${id}`.replace(".", "\\.")).val()
        saveNote(id, note)
    })
    $(".edit-note-item").click((e) => {
        e.preventDefault();
        const id = e.target.id.replace("edit-note-item-", "");
        $(`#form-note-${id}`.replace(".", "\\.")).fadeIn()
    })
    $(".cancel-note-form").click((e) => {
        e.preventDefault();
        const id = e.target.id.replace("cancel-note-form-", "");
        $(`#form-note-${id}`.replace(".", "\\.")).hide();
    })
    $(".memory-item-expand").click((e) => {
        e.preventDefault();
        const id = e.target.id.replace("memory-item-expand-", "");
        const eid = id.replace(".", "\\.");
        if ($(`#memory-item-expand-${eid}`).hasClass('expand-open')) {
            $(`#memory-item-expand-${eid}`).removeClass("expand-open");
            $(`#extended-item-${eid}`).slideUp();
        } else {
            $(`#memory-item-expand-${eid}`).addClass("expand-open");
            $(`#extended-item-${eid}`).slideDown();
        }
    })

}

const saveNote = (id, note) => {
    console.log(id, note);
    state.papers[id].note = note
    chrome.storage.local.set({ "papers": state.papers }, () => {
        console.log("Updated the note for " + state.papers[id].title);
        $(`#form-note-${id}`.replace(".", "\\.")).hide();
        $(`#note-content-${id}`.replace(".", "\\.")).text(note);
    })
}

const copyAndConfirmMemoryItem = (arxivId, textToCopy, feedbackText) => {
    const elementId = `#memory-item-feedback-${arxivId}`.replace(".", "\\.")
    copyTextToClipboard(textToCopy)
    $(elementId).text(feedbackText)
    $(elementId).fadeIn()
    setTimeout(
        () => {
            $(elementId).text("")
        },
        1000
    )
}

const confirmDelete = arxivId => {
    const title = state.papers[arxivId].title;
    $("body").append(`
    <div style="width: 100%; height: 100%; background-color:  #e0e0e0; position: absolute; top: 0; left: 0; z-index: 100; display:  flex; justify-content:  center; align-items: center; flex-direction: column" id="confirm-modal">
    
    <div style="width: 80%; padding: 32px 32px; text-align: center; font-size: 1.1rem;">
        Are you sure you want to delete:
         <p>${title}</p>
         ?
    </div>
    
    <div style="width: 100%; text-align: center; padding: 32px;">
        <button style="padding: 8px 16px;" id="cancel-modal-button">Cancel</button>
        <span style="min-width: 32px;"></span>
        <button style="padding: 8px 16px;" id="confirm-modal-button">Confirm</button>
    </div>
    
    </div>
    `)
    $("#cancel-modal-button").click(() => {
        $("#confirm-modal").remove()
    })
    $("#confirm-modal-button").click(() => {
        delete state.papers[arxivId]
        chrome.storage.local.set({ "papers": state.papers }, () => {
            state.papersList = Object.values(state.papers);
            makeMemoryTable();
            displayMemoryTable()
            $("#confirm-modal").remove()
            console.log("Successfully deleted '" + title + "' from ArxivMemory")
        })
    })

}

const setMemorySortArrow = direction => {
    let arrow;
    if (direction === "up") {
        arrow = `<svg class="memory-sort-arrow-svg" id="memory-sort-arrow-up">
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-arrow-narrow-up" />
                </svg>`
    } else {
        arrow = `<svg class="memory-sort-arrow-svg" id="memory-sort-arrow-down">
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-arrow-narrow-down" />
                </svg>`
    }

    $("#memory-sort-arrow").html(arrow)
}

const openMemory = () => {
    state.menuIsOpen && closeMenu();
    $("#tabler-menu").fadeOut()
    $("#memory-select").val("lastOpenDate")
    setMemorySortArrow("down")
    setTimeout(() => {
        $("#memory-container").slideDown(
            {
                duration: 500,
                easing: "easeOutQuint"
                ,
            },
        );
        $("#memory-switch-text-on").fadeOut(() => {
            $("#memory-switch-text-off").fadeIn()
        });
        $("#memory-select").change((e) => {
            const sort = $(e.target).val();
            state.sortKey = sort;
            sortMemory();
            makeMemoryTable();
            displayMemoryTable();
            setMemorySortArrow("down")
        })
        $("#memory-sort-arrow").click((e) => {
            if ($("#memory-sort-arrow svg").first()[0].id === "memory-sort-arrow-down") {
                setMemorySortArrow("up")
            } else {
                setMemorySortArrow("down")
            }
            reverseMemory()
            makeMemoryTable()
            displayMemoryTable()
        })
        chrome.storage.local.get("papers", function ({ papers }) {
            console.log("Found papers:")
            console.log(papers)
            state.papers = papers;
            state.papersList = Object.values(papers);
            state.sortKey = "lastOpenDate";
            $("#memory-search").attr("placeholder", `Search ${state.papersList.length} entries ...`);

            if (state.papersList.length < 30) {
                delayTime = 0;
            } else if (state.papersList.length < 100) {
                delayTime = 200;
            } else {
                delayTime = 350;
            } {

            }

            $("#memory-search").keyup(delay((e) => {
                const letters = $(e.target).val();
                filterMemory(letters);
                makeMemoryTable();
                displayMemoryTable();
            }, delayTime))

            sortMemory()
            makeMemoryTable()
            displayMemoryTable()
        })

    }
        , state.menuIsOpen ? 500 : 0)
}

const closeMemory = () => {
    $("#memory-container").slideUp({
        duration: 500,
        easing: "easeOutQuint"
    });
    $("#memory-switch-text-off").fadeOut(() => {
        $("#memory-switch-text-on").fadeIn()
    });
    $("#tabler-menu").fadeIn()
}

const main = tab => {

    var feedbackTimeout = null;
    var feedbackPrevent = false;

    const feedback = () => {
        try {
            clearTimeout(feedbackTimeout)
            $("#feedback-notif").remove();
            feedbackPrevent = true;
        } catch (error) {
            console.log("No feedback to remove.")
        }
        $("#menuDiv").append(`
            <div id="check-feedback">
                <svg class="tabler-icon">
                    <use xlink:href="../../icons/tabler-sprite-nostroke.svg#tabler-floppy-disk" />
                </svg>
            </div>
        `)
        $("#check-feedback").animate({
            right: "12px",
            opacity: "1"
        }, 300, "easeInOutBack");
        feedbackTimeout = setTimeout(() => {
            $("#check-feedback").animate({
                right: "-100px",
                opacity: "0"
            }, 300, "easeInOutBack", () => {
                !feedbackPrevent && $("#check-feedback").remove();
                feedbackPrevent = false;
            });

        }, 1500)
    }

    const url = parseUrl(tab.url);
    // console.log(url);


    $("#helpGithubLink").click(() => {
        chrome.tabs.update({
            url: "https://github.com/vict0rsch/ArxivTools"
        });
    })
    $("#coblock").click(() => {
        chrome.tabs.update({
            url: "https://marketplace.visualstudio.com/items?itemName=vict0rsch.coblock"
        });
    })

    $("#tabler-menu").click(() => {
        state.menuIsOpen ?
            closeMenu()
            :
            openMenu()
        state.menuIsOpen = !state.menuIsOpen;
    })

    $("#memory-switch").click(() => {
        state.memoryIsOpen ?
            closeMemory()
            :
            openMemory()
        state.memoryIsOpen = !state.memoryIsOpen;
    })

    $("#download-arxivmemory").click(() => {
        const now = (new Date()).toLocaleString();
        chrome.storage.local.get("papers", ({ papers }) => {
            downloadTextFile(JSON.stringify(papers), `arxiv-memory-${now}.json`, "text/json")
        })
    })

    const checks = ["checkBib", "checkMd", "checkDownload", "checkPdfTitle", "checkVanity", "checkMemory"]
    chrome.storage.local.get(checks, function (items) {

        const hasKey = {};
        for (const key of checks) {
            hasKey[key] = items.hasOwnProperty(key);
        }
        const setValues = {}
        for (const key of checks) {
            setValues[key] = hasKey[key] ? items[key] : true;
        }
        chrome.storage.local.set(setValues, function () {
            chrome.storage.local.get(checks, function (items) {
                for (const key of checks) {
                    $("#" + key).prop("checked", items[key]);
                    setValues[key] = hasKey[key] ? items[key] : true;
                }
            });
        });

        for (const key of checks) {
            $("#" + key).change(function () {
                const checked = this.checked;
                chrome.storage.local.set({ [key]: checked }, function () {
                    feedback()
                    console.log(`Settings saved for ${key} (${checked})`);
                });
            });
        }


        if (url.hostname === "arxiv.org") {
            $("#notArxiv").hide();
            $("#notPdf").show();
            $("#bibtex-card-content").slideUp();
            if (url.href.endsWith(".pdf")) {
                $("#notPdf").hide();
                $("#isArxiv").show();
                const paperId = url.href.split("/").reverse()[0].replace(".pdf", "");
                const newURL = `https://arxiv.org/abs/` + paperId;
                $("#goToAbstract").text(paperId);
                $("#abstract-card").click((e) => {
                    chrome.tabs.update({
                        url: newURL
                    });
                    window.close();
                })
                $.get(`https://export.arxiv.org/api/query?id_list=${paperId}`).then(data => {
                    const { bibvars, bibtext } = parseArxivBibtex(data)
                    $("#abstract-card-title").text(bibvars.title);
                    $("#bibtex-card-content").text(bibtext);
                    $("#bibtex-card-header").click((e) => {
                        copyTextToClipboard($("#bibtex-card-content").text());
                        $("#bibtex-svg").fadeOut(() => {
                            $("#clipboard-ok").fadeIn(() => {
                                setTimeout(() => {
                                    $("#clipboard-ok").fadeOut(() => {
                                        $("#bibtex-svg").fadeIn()
                                    })
                                }, 1500)
                            })
                        })
                    })
                });
            }
        }
    });
}

$(() => {

    chrome.tabs.query({
        'active': true,
        'lastFocusedWindow': true
    }, function (tabs) {
        var url = tabs[0].url;
        main(tabs[0])
    });

});
