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

    var $methodLinks = $('.method-link');

    $('#search-methods').on('keyup', function (e) {

        var query = new RegExp(e.target.value.replace(' ', '|'), 'ig');

        $methodLinks.each(function () {

            var $this = $(this);

            if (!$this.text().match(query)) {

                $this.hide();

            } else {

                $this.show();

            }

        });

    });

    $(window).on('scroll', handleScrollEvent);

    handleScrollEvent();

    $('#releases').on('change', function () {

        var $this = $(this);

        window.location.href = $(this).val();

    });

})();
