/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'cocktail',
  'chai',
  'sinon',
  'views/mixins/checkbox-mixin',
  'views/base',
  'stache!templates/test_template'
], function (Cocktail, Chai, sinon, CheckboxMixin, BaseView, Template) {
  'use strict';

  var assert = Chai.assert;

  var View = BaseView.extend({
    template: Template
  });

  Cocktail.mixin(
    View,
    CheckboxMixin
  );

  describe('views/mixins/checkbox-mixin', function () {
    var view;

    beforeEach(function () {
      view = new View({
        screenName: 'checkbox-view'
      });

      return view.render()
        .then(function () {
          $('#container').html(view.el);
        });
    });

    it('adds custom checkboxes', function () {
      assert.isTrue($('#container').find('.fxa-checkbox.is-upgraded').length > 0);
    });

    it('logs when a checkbox is toggled on', function () {
      sinon.spy(view, 'logScreenEvent');

      view.$('#show-password').click();

      assert.isTrue(view.logScreenEvent.calledWith('checkbox.change.show-password.checked'));
    });

    it('logs when a checkbox is toggled off', function () {
      sinon.spy(view, 'logScreenEvent');

      view.$('#show-password').attr('checked', 'checked').click();

      assert.isTrue(view.logScreenEvent.calledWith('checkbox.change.show-password.unchecked'));
    });

    it('works if the element has a `name` but no `id`', function () {
      sinon.spy(view, 'logScreenEvent');
      view.$('input[name="named-checkbox"]').click().click();

      assert.isTrue(view.logScreenEvent.calledWith('checkbox.change.named-checkbox.checked'));
      assert.isTrue(view.logScreenEvent.calledWith('checkbox.change.named-checkbox.unchecked'));
    });
  });
});

