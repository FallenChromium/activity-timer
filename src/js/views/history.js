require('../../sass/main.scss');

const { apiKey, appName, formatTime } = require('../shared.js');

const t = window.TrelloPowerUp.iframe({
    appKey: apiKey,
    appName: appName
});

const membersEl = document.querySelector('.members');
const labelsEl = document.querySelector('.labels');
const resultsEl = document.querySelector('.results');

let dataCache = null;

class Range {
    memberId = null;
    startTime = null;
    endTime = null;

    constructor(data) {
        this.memberId = data[0];
        this.startTime = data[1];
        this.endTime = data[2];
    }

    getTimeSpend () {
        return this.endTime - this.startTime;
    }
}

class Card {
    id = null;
    ranges = null;
    labels = null;

    constructor(data) {
        this.id = data.id;
        this.ranges = [];
        this.labels = data.labels || [];

        if (typeof data.pluginData !== 'undefined') {
            data.pluginData.forEach((pluginData) => {
                if (pluginData.scope === 'card' && pluginData.access === 'shared') {
                    pluginData.value = JSON.parse(pluginData.value);

                    if (
                        typeof pluginData.value['act-timer-ranges'] !== 'undefined' &&
                        pluginData.value['act-timer-ranges'].length > 0
                    ) {
                        pluginData.value['act-timer-ranges'].forEach((range) => {
                            this.ranges.push(new Range(range));
                        });
                    }
                }
            });
        }
    }
}

/**
 * Fetch data & process it.
 *
 * @returns {Promise<{cards: *, members: [], labels: []}>}
 */
async function fetchData () {
    if (dataCache == null) {
        const token = await t.getRestApi().getToken();
        const board = await t.board('id');

        const data = await fetch('https://api.trello.com/1/boards/' + board.id + '/cards/all?pluginData=true&fields=id,labels,pluginData,closed&key=' + apiKey + '&token=' + token);
        const json = await data.json();

        const cards = json.map((item) => {
            return new Card(item);
        });

        const members = [];
        let labels = [];
        const labelsById = {};

        cards.forEach((card) => {
            card.ranges.forEach((range) => {
                if (members.indexOf(range.memberId) === -1) {
                    members.push(range.memberId);
                }
            });

            card.labels.forEach((label) => {
                if (labels.indexOf(label.id) === -1) {
                    labels.push(label.id);
                    labelsById[label.id] = label;
                }
            });
        });

        labels = labels.map((labelId) => {
            return labelsById[labelId];
        });

        const memberData = await fetch('https://api.trello.com/1/boards/' + board.id + '/members?fields=id,username,avatarUrl&key=' + apiKey + '&token=' + token);
        const memberJson = await memberData.json();

        const cardMembers = memberJson.filter((member) => {
            return members.indexOf(member.id) !== -1;
        });

        const membersById = {};

        cardMembers.forEach((member) => {
            membersById[member.id] = member;
        });

        dataCache = {
            cards,
            members: cardMembers,
            membersById,
            labels,
        };

        console.log(dataCache);
    }

    return dataCache;
}

/**
 * Analytics renderer.
 *
 * @returns {Promise<void>}
 */
async function analyticsRenderer () {
    // Fetch processed trello data
    const processedData = await fetchData();

    // Construct fragments
    const membersFragment = document.createDocumentFragment();
    const labelsFragment = document.createDocumentFragment();
    const resultsFragment = document.createDocumentFragment();

    const selectedMembers = [];
    const selectedLabels = [];

    // Fetch selected members
    document.querySelectorAll('.members__item-input:checked').forEach((el) => {
        selectedMembers.push(el.getAttribute('data-id'));
    });

    // Fetch selected labels
    document.querySelectorAll('.labels__item-input:checked').forEach((el) => {
        selectedLabels.push(el.getAttribute('data-id'));
    });

    console.log('selectedMembers: ', selectedMembers);
    console.log('selectedLabels: ', selectedLabels);

    // Process members

    processedData.members.forEach((member) => {
        const memberEl = document.createElement('div');
        memberEl.className = 'members__item';

        const checkboxEl = document.createElement('input');
        checkboxEl.type = 'checkbox';
        checkboxEl.className = 'members__item-input';
        checkboxEl.id = 'member-' + member.id;
        checkboxEl.setAttribute('data-id', member.id);
        checkboxEl.addEventListener('change', analyticsRenderer);
        checkboxEl.checked = selectedMembers.indexOf(member.id) !== -1;

        const labelEl = document.createElement('label');
        labelEl.for = 'member-' + member.id;
        labelEl.className = 'members__item-label';
        labelEl.innerText = member.username;

        memberEl.appendChild(checkboxEl);
        memberEl.appendChild(labelEl);

        membersFragment.appendChild(memberEl);
    });

    // Cleanup existing member DOM nodes
    while (membersEl.firstChild) {
        membersEl.removeChild(membersEl.lastChild);
    }

    membersEl.appendChild(membersFragment);

    // Process labels

    processedData.labels.forEach((label) => {
        let labelWrapEl = document.createElement('div');
        labelWrapEl.className = 'labels__item';

        let checkboxEl = document.createElement('input');
        checkboxEl.type = 'checkbox';
        checkboxEl.className = 'labels__item-input';
        checkboxEl.id = 'label-' + label.id;
        checkboxEl.setAttribute('data-id', label.id);
        checkboxEl.addEventListener('change', analyticsRenderer);
        checkboxEl.checked = selectedLabels.indexOf(label.id) !== -1;

        let labelEl = document.createElement('label');
        labelEl.for = 'label-' + label.id;
        labelEl.className = 'labels__item-label';
        labelEl.innerText = label.name;

        labelWrapEl.appendChild(checkboxEl);
        labelWrapEl.appendChild(labelEl);

        labelsFragment.appendChild(labelWrapEl);
    });

    // Cleanup existing label DOM nodes
    while (labelsEl.firstChild) {
        labelsEl.removeChild(labelsEl.lastChild);
    }

    labelsEl.appendChild(labelsFragment);

    const timeSpentByMember = [];

    processedData.cards.forEach((card) => {
        card.ranges.forEach((range) => {
            if (selectedMembers.indexOf(range.memberId) !== -1) {
                if (typeof timeSpentByMember[range.memberId] === 'undefined') {
                    timeSpentByMember[range.memberId] = 0;
                }

                timeSpentByMember[range.memberId] += range.getTimeSpend();
            }
        });
    });

    timeSpentByMember.forEach((timeSpent, memberId) => {
        const resultEl = document.createElement('div');
        resultEl.innerText = dataCache.membersById[memberId].username + ': ' + formatTime(timeSpent);

        resultsFragment.appendChild(resultEl);
    });

    while (resultsEl.firstChild) {
        resultsEl.removeChild(resultsEl.lastChild);
    }

    resultsEl.appendChild(resultsFragment);

    document.querySelector('.wrapper').style.display = 'block';
}

;(async () => {
    const isAuthorized = await t.getRestApi().isAuthorized();
    const authorizeEl = document.querySelector('.authorize');
    const authorizeBtnEl = document.querySelector('.authorize-btn');

    if (isAuthorized) {
        await analyticsRenderer();
    } else {
        authorizeEl.style.display = 'block';
        authorizeBtnEl.addEventListener('click', async () => {
            if (!isAuthorized) {
                await t.getRestApi().authorize({
                    scope: 'read',
                    expiration: '30days'
                });

                authorizeEl.style.display = 'block';

                await analyticsRenderer();
            }
        });
    }

    t.render(async () => {
        t.sizeTo('body');
    });
})();