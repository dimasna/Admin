import Controller from '@ember/controller';
import {alias} from '@ember/object/computed';
import {computed} from '@ember/object';
import {task, timeout} from 'ember-concurrency';

export default Controller.extend({
    integration: alias('model'),

    allWebhooks: computed(function () {
        return this.store.peekAll('webhook');
    }),

    filteredWebhooks: computed('allWebhooks.@each.{isNew,isDeleted}', function () {
        return this.allWebhooks.filter((webhook) => {
            let matchesIntegration = webhook.belongsTo('integration').id() === this.integration.id;

            return matchesIntegration
                && !webhook.isNew
                && !webhook.isDeleted;
        });
    }),

    actions: {
        save() {
            return this.save.perform();
        },

        toggleUnsavedChangesModal(transition) {
            let leaveTransition = this.leaveScreenTransition;

            if (!transition && this.showUnsavedChangesModal) {
                this.set('leaveScreenTransition', null);
                this.set('showUnsavedChangesModal', false);
                return;
            }

            if (!leaveTransition || transition.targetName === leaveTransition.targetName) {
                this.set('leaveScreenTransition', transition);

                // if a save is running, wait for it to finish then transition
                if (this.save.isRunning) {
                    return this.save.last.then(() => {
                        transition.retry();
                    });
                }

                // we genuinely have unsaved data, show the modal
                this.set('showUnsavedChangesModal', true);
            }
        },

        leaveScreen() {
            let transition = this.leaveScreenTransition;

            if (!transition) {
                this.notifications.showAlert('Sorry, there was an error in the application. Please let the Ghost team know what happened.', {type: 'error'});
                return;
            }

            // roll back changes on model props
            this.integration.rollbackAttributes();

            return transition.retry();
        }
    },

    save: task(function* () {
        return yield this.integration.save();
    }),

    copyContentKey: task(function* () {
        this._copyInputTextToClipboard('input#content_key');
        yield timeout(3000);
    }),

    copyAdminKey: task(function* () {
        this._copyInputTextToClipboard('input#admin_key');
        yield timeout(3000);
    }),

    _copyInputTextToClipboard(selector) {
        let input = document.querySelector(selector);
        input.disabled = false;
        input.focus();
        input.select();
        document.execCommand('copy');
        input.disabled = true;
    }
});
