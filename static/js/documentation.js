(function () {

    'use strict';

    var headerHeight = $('.jumbotron').outerHeight(true),
        $backToTop = $('.back-to-top');

    function handleScrollEvent() {

        if (window.scrollY > headerHeight && $backToTop.not('.visible')) {

            $backToTop.addClass('visible');

        } else if (window.scrollY < headerHeight && $backToTop.is('.visible')) {

            $backToTop.removeClass('visible');

        }

    }

    $('pre code:not(.hljs)').each(function () {
        hljs.highlightBlock(this);
    });

    var $searchInput = $('#search-methods');
    var $methodLinks = $('.method-link');
    var $methodNames = $('.method .method-name');

    var urlQuery = window.location.search.match(/q=([^&]+)/);

    $searchInput.on('keyup', function (e) {

        var query = new RegExp(e.target.value.replace(' ', '|'), 'ig');

        $methodLinks.each(function () {

            var $this = $(this);

            if (!$this.text().match(query)) {

                $this.hide();

            } else {

                $this.show();

            }

        });

        $methodNames.each(function () {

            var $this = $(this);

            if (!$this.text().match(query)) {

                $this.closest('.method').hide();

            } else {

                $this.closest('.method').show();

            }

        });

        window.history.replaceState({}, '', window.location.pathname + '?q=' + e.target.value);

    });

    $searchInput.on('search', function () {

        $searchInput.trigger('keyup');

    });

    if (urlQuery && urlQuery.length > 1) {

        $searchInput.val(urlQuery[1]).trigger('keyup');

    }

    $(window).on('scroll', handleScrollEvent);

    handleScrollEvent();

    $('#releases').on('change', function () {

        var $this = $(this);

        window.location.href = $(this).val();

    });

})();
