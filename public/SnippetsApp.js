var SnippetsApp = new Vue({
    el: '#SnippetsApp',
    data: {
        title: window.SnippetsAppConfig.title,
        categories: window.SnippetsAppConfig.categories,
        languages: window.SnippetsAppConfig.languages,
        defaultLanguage: window.SnippetsAppConfig.defaultLanguage,

        baseUrl: '',
        showIntro: true,
        showLoading: true,
        snippets: [],
        showAdminAuth: false,
        showAdminControls: false,
        filterText: '',
        filterCategories: [],
        filterStates: []
    },

    created: function() {
        document.title = this.title;

        // load the about box's content
        $.get('/about.html?now='+ new Date().getTime(), function(data, textStatus, jqXHR) {
            $('.aboutContent').html(data);
        });

        // determine base URL for sharing link
        if (typeof window.SnippetsAppConfig.baseUrl == 'string') {
            this.baseUrl = window.SnippetsAppConfig.baseUrl;

            // add trailing slash if missing
            if (this.baseUrl.lastIndexOf('/') != this.baseUrl.length -1) {
                this.baseUrl = this.baseUrl +'/';
            }
        } else {
            // determine base url based on the applications url
            this.baseUrl = window.location.href +'';

            // http and https
            if (window.location.protocol.indexOf('http') == 0) {
                this.baseUrl = this.baseUrl.substr(0, this.baseUrl.lastIndexOf(window.location.pathname +'')) +'/';
            }
        }

        // load snippets
        this.loadPublicSnippets();
    },

    mounted: function() {
        this.applyURLControls();
    },

    updated: function() {
        Prism.highlightAll();
        
        $('.snippet').removeClass('mb-3');
        $('.snippet.d-block').last().addClass('mb-3');

        $('#snippetsCount').html(this.snippetShowCount())
    },

    methods: {
        snippetShowCount: function() {
            var totalSnippets  = $('.snippet').length;
            var hiddenSnippets = $('.snippet.d-none').length;

            return totalSnippets - hiddenSnippets;
        },

        showAbout: function() {
            $('#aboutDialog').modal('show');
        },

        applyURLControls: function() {
            if ((window.location.hash +'').indexOf('#snippet:') == 0) {
                this.filterText = 'id:'+ (window.location.hash +'').replace('#snippet:', '');
            }

            if ((window.location.hash +'').indexOf('#categories:') == 0) {
                this.filterCategories = (window.location.hash +'').replace('#categories:', '').split(',');
            }

            if ((window.location.hash +'').indexOf('#contribute') == 0) {
                this.contribute();
            }

            if ((window.location.hash +'').indexOf('#about') == 0) {
                $('#aboutBox').collapse('show');
            }

            if ((window.location.search +'').indexOf('admin=true') >=  0) {
                this.showAdminAuth = true;
                this.loadAdminInterface();
            }
        },

        contribute: function() {
            // remove any validation flag
            $('#contributionDialog *').removeClass('is-valid');
            $('#contributionDialog *').removeClass('is-invalid');

            // empty snippet related fields (excl. contact information)
            $('#snippetTitle').val('');
            $('#snippetCode').val('');
            $('#snippetRemarks').val('');
            try { $('#snippetCategories').selectpicker('deselectAll'); } catch(err) {}
            try { $('#snippetLanguage').selectpicker('val', this.defaultLanguage); } catch(err) {}
            $('#snippetTags').val('');
            $('#snippetLink').val('');

            // finally show dialog
            $('#contributionDialog').modal('show');
        },

        adminAuth: function(authTitle, callback) {
            var thisArg = this;

            $('#adminAuthDialogTitle').html(authTitle);
            $('#adminAuthToken').val('');

            $('#adminAuthDialogSubmitBtn').unbind( "click" );
            $('#adminAuthDialogSubmitBtn').click(function() {
                if (typeof callback == 'function') {
                    var username = $('#adminAuthUsername').val();
                    var password = $('#adminAuthPassword').val();
                    var token    = $('#adminAuthToken').val();

                    callback.call(thisArg, username, password, token);
                }
            });
            $('#adminAuthDialog').modal('show');
        },

        convertRawSnippets: function(snippets) {
            if (!(snippets instanceof Array)) {
                snippets = [].push(snippets);
            }

            snippets = [].concat(snippets);

            // sort by submitted date 
            snippets = snippets.sort(function(a, b) {
                if (a.state == b.state) {
                    return +b.submitted_at - +a.submitted_at;
                } else {
                    var stateScore = {
                        "new":       1,
                        "declined":  2,
                        "published": 3,
                        "retired":   4
                    };

                    return stateScore[a.state] - stateScore[b.state];
                }
            });

            // convert dates and arrays
            for  (var i = 0; i < snippets.length; i++) {
                if (snippets[i].categories && snippets[i].categories != null && snippets[i].categories != 0) {
                    snippets[i].categories = snippets[i].categories.split(',');
                }

                if (snippets[i].tags && snippets[i].tags != null && snippets[i].tags != 0) {
                    snippets[i].tags = snippets[i].tags.split(',');
                }

                if (snippets[i].submitted_at != null && snippets[i].submitted_at != 0) {
                    submitted_at = new Date(); submitted_at.setTime(snippets[i].submitted_at);
                    snippets[i].submitted_at = submitted_at;
                }

                if (snippets[i].published_at != null && snippets[i].published_at != 0) {
                    published_at = new Date(); published_at.setTime(snippets[i].published_at);
                    snippets[i].published_at = published_at;
                }

                if (snippets[i].retired_at != null && snippets[i].retired_at != 0) {
                    retired_at = new Date(); retired_at.setTime(snippets[i].retired_at);
                    snippets[i].retired_at = retired_at;
                }

                snippets[i].action = 'leave';
            }

            return snippets;
        },

        postContributedSnippet: function() {
            var thisArg = this;

            var snippet = {
                contact_email: $('#contributorMail').val(),
                contact_name: $('#contributorName').val(),
                author: $('#snippetAuthor').val(),

                title: $('#snippetTitle').val(),
                code: $('#snippetCode').val(),
                language: $('#snippetLanguage').val(),
                remarks: $('#snippetRemarks').val(),

                categories: ($('#snippetCategories').val() +'').split(','),
                tags: ($('#snippetTags').val() +'').split(','),
                external_link: $('#snippetLink').val()
            };

            // form validations
            if (snippet.author.trim() == '') {
                $('#snippetAuthor').removeClass('is-valid');
                $('#snippetAuthor').addClass('is-invalid');
            } else {
                $('#snippetAuthor').removeClass('is-invalid');
                $('#snippetAuthor').addClass('is-valid');
            }
            if (snippet.contact_name.trim() == '') {
                $('#contributorName').removeClass('is-valid');
                $('#contributorName').addClass('is-invalid');
            } else {
                $('#contributorName').removeClass('is-invalid');
                $('#contributorName').addClass('is-valid');
            }
            if (snippet.contact_email.trim() == '') {
                $('#contributorMail').removeClass('is-valid');
                $('#contributorMail').addClass('is-invalid');
            } else {
                $('#contributorMail').removeClass('is-invalid');
                $('#contributorMail').addClass('is-valid');
            }
            if (snippet.title.trim() == '' || snippet.title.trim().length <= 5) {
                $('#snippetTitle').removeClass('is-valid');
                $('#snippetTitle').addClass('is-invalid');
            } else {
                $('#snippetTitle').removeClass('is-invalid');
                $('#snippetTitle').addClass('is-valid');
            }
            if (snippet.categories.length == 0) {
                $('#snippetCategories').removeClass('is-valid');
                $('#snippetCategories').addClass('is-invalid');
            } else {
                $('#snippetCategories').removeClass('is-invalid');
                $('#snippetCategories').addClass('is-valid');
            }
            if (snippet.code.trim() == '' || snippet.code.trim().length <= 10) {
                $('#snippetCode').removeClass('is-valid');
                $('#snippetCode').addClass('is-invalid');
            } else {
                $('#snippetCode').removeClass('is-invalid');
                $('#snippetCode').addClass('is-valid');
            }

            $.ajaxSetup({
                headers: {
                    'Authorization': 'None'
                }
            });
            $.post('/snippet', JSON.stringify(snippet), function(data, textStatus, jqXHR) {
                if (data.result == 'success') {                        
                    // add returned snippet to the interface
                    thisArg.snippets.unshift(thisArg.convertRawSnippets(data.object));
                    alert('Snippet has been handed in!');
                    $('#contributionDialog').modal('hide');
                } else {
                    alert(data.error);
                }
            }, 'json');
        },

        loadPublicSnippets: function() {
            var thisArg = this;

            this.snippets = [];
            this.showLoading = true;

            $.get('/snippets/published?now='+ new Date().getTime(), function(data, textStatus, jqXHR) {
                if (data.result == 'success') {
                    thisArg.snippets = thisArg.convertRawSnippets(data.object);
                    thisArg.showLoading = false;
                } else {
                    alert(data.error);
                }
            }, 'json');
        },

        loadAdminInterface: function() {
            var thisArg = this;

            this.adminAuth('Authorize for Administration', function(username, password, token) {
                this.showLoading = true;
                
                $.ajaxSetup({
                    headers: {
                        'Authorization': 'Basic '+ btoa(username +':'+ token +':'+ password)
                    }
                });
                $.get('/snippets?now='+ new Date().getTime(), function(data, textStatus, jqXHR) {
                    if (data.result == 'success') {                        
                        // switch on admin interface
                        thisArg.snippets = thisArg.convertRawSnippets(data.object);
                        thisArg.showAdminControls = true;
                        thisArg.showLoading = false;
                    } else {
                        alert(data.error);
                    }
                }, 'json');
            });
        },

        markSnippet: function(snippet, action) {
            snippet.action = action;
        },

        applySnippet: function() {
            var thisArg = this;

            var snippetsToApply =  [];

            for (var i = 0; i < this.snippets.length; i++) {
                if (this.snippets[i].action == 'publish') {
                    snippetsToApply.push({id: this.snippets[i].id, state: 'published'});
                }

                if (this.snippets[i].action == 'decline') {
                    snippetsToApply.push({id: this.snippets[i].id, state: 'declined'});
                }

                if (this.snippets[i].action == 'retire') {
                    snippetsToApply.push({id: this.snippets[i].id, state: 'retired'});
                }

                if (this.snippets[i].action == 'delete') {
                    snippetsToApply.push({id: this.snippets[i].id, state: 'deleted'});
                }
            }

            this.adminAuth('Authorize to apply changes', function(username, password, token) {
                this.showLoading = true;

                $.ajaxSetup({
                    headers: {
                        'Authorization': 'Basic '+ btoa(username +':'+ token +':'+ password)
                    }
                });
                $.post('/snippets', JSON.stringify(snippetsToApply), function(data, textStatus, jqXHR) {
                    if (data.result == 'success') {                    
                        // switch on admin interface
                        thisArg.snippets = [];
                        thisArg.snippets = thisArg.convertRawSnippets(data.object);
                        thisArg.showLoading = false;
                    } else {
                        alert(data.error);
                    }
                }, 'json');
            });
        },

        filter: function(snippet) {
            var show = true;

            var snippetText  = JSON.stringify(snippet);
                snippetText += '{id:'+ snippet.id +',author:'+ snippet.author +',title:'+ snippet.title +'}';
                snippetText  = snippetText.toLowerCase();

            var categoryMatcher = this.filterCategories.length == 0;
            for (var i = 0; i < this.filterCategories.length; i++) {
                categoryMatcher = categoryMatcher || snippet.categories.indexOf(this.filterCategories[i]) >= 0;
            }
            show = show && categoryMatcher;

            if (this.filterText != '') {
                var searchTerms = this.filterText.split(' ');

                var currentSearchTerm = '';
                var currentSearchTermParts = [];
                var currentSearchTermCompleted = true;

                for (var i = 0; i < searchTerms.length; i++) {
                    if (currentSearchTermCompleted) {
                        if (searchTerms[i].indexOf('"') == 0) {
                            currentSearchTerm = '';
                            currentSearchTermCompleted = false;
                        } else {
                            currentSearchTerm = searchTerms[i];
                            currentSearchTermCompleted = true;
                        }
                    }

                    if (!currentSearchTermCompleted) {
                        currentSearchTermParts.push(searchTerms[i])
                        currentSearchTerm = currentSearchTermParts.join(' ');
                        
                        if (searchTerms[i].indexOf('"') == searchTerms[i].length -1) {
                            currentSearchTermCompleted = true;
                            currentSearchTerm = currentSearchTerm.substr(1, currentSearchTerm.length -2);
                        }
                    }
                    
                    if (currentSearchTermCompleted) {
                        currentSearchTerm = currentSearchTerm.trim();
                        if (currentSearchTerm != '') {
                            show = show && snippetText.indexOf(currentSearchTerm.toLowerCase()) >= 0;
                        }
                    }
                }
            }

            return show;
        },

        filterIsActive: function() {
            return this.filterText != '' || this.filterCategories.length > 0;
        },

        clearFilter: function() {
            try { $('.category-picker').selectpicker('deselectAll'); } catch(err) {}
            this.filterCategories = [];
            this.filterText = '';
        },

        copy: function(index, snippet) {
            var jqElem = $('#snippet'+ snippet.id +'Code');
            var elem   = jqElem.get(0);
            jqElem.toggleClass('d-none');
            elem.select();
            elem.setSelectionRange(0, jqElem.val().length);
            document.execCommand("copy");
            jqElem.toggleClass('d-none');
        },

        share: function(index, snippet) {
            $('#shareDialogSnippetTitle').html(snippet.title);

            $('#shareDialogInput').val(this.baseUrl +'#snippet:'+ snippet.id);
            $('#shareDialog').modal('show');

            var jqElem = $('#shareDialogInput');
            var elem   = jqElem.get(0);
            elem.focus();
            elem.select();
            elem.setSelectionRange(0, jqElem.val().length);
        }
    }
});