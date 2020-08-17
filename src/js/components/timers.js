const Timer = require('./timer.js');

module.exports = class Timers {
    /**
     * @var Timer[]
     */
    _items = [];

    /**
     * Timers constructor.
     *
     * @param timers
     */
    constructor(timers) {
        if (timers) {
            timers.forEach((timer) => {
                this.add(timer[0], timer[1], timer[2]);
            });
        }
    }

    /**
     * Add timer.
     *
     * @param {string} memberId
     * @param {string} listId
     * @param {number} start
     */
    add (memberId, listId, start) {
        this._items.push(new Timer(memberId, listId, start));
    }

    /**
     * Delete by index.
     *
     * @param index
     */
    deleteByIndex (index) {
        this.items.splice(index, 1);
    }

    /**
     * Serialize items into a JSON string.
     *
     * @returns {*}
     */
    serialize () {
        return this.items.map((timer) => {
            return timer.serialize();
        });
    }

    /**
     * @param t
     *
     * @returns {Promise<void>}
     */
    async saveForContext (t) {
        await t.set('card', 'shared', 'act-timer-running', this.serialize());
    }

    /**
     * Start by member id.
     * 
     * @param {string} memberId 
     * @param {string} listId 
     */
    startByMember (memberId, listId) {
        this._items = this._items.filter((item) => {
            return item.memberId !== memberId;
        });

        this.add(memberId, listId, Math.floor(new Date().getTime() / 1000));
    }

    /**
     * Remove timer by member id.
     *
     * @param {string} memberId 
     */
    removeByMember (memberId) {
        this._items = this._items.filter((item) => {
            return item.memberId !== memberId;
        });
    }

    /**
     * Get timer by member id.
     *
     * @param {*} memberId 
     */
    getByMember (memberId) {
        return this._items.reduce((carry, item) => {
            if (item.memberId === memberId) {
                carry = item;
            }
            return carry;
        }, null);
    }

    /**
     * @returns {Timer[]}
     */
    get items () {
        return this._items;
    }

    /**
     * Unserialize raw data into Timers instances.
     *
     * @param data
     *
     * @returns {Timers}
     */
    static unserialize (data) {
        return new Timers(data);
    }

    /**
     * Get Timers instance from context.
     *
     * @param {*} t 
     * 
     * @returns {Promise<Timers>}
     */
    static async getFromContext (t) {
        return Timers.unserialize((await t.get('card', 'shared', 'act-timer-running', [])));
    }
}