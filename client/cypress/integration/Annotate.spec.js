describe('Annotate', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Go to annotate videos page', () => {
    cy.server();
    cy.route('GET', '/api/videos').as('getVideos');

    expect(localStorage.getItem('username')).to.eq('test123');
    cy.visit('/');
    cy.get('#navbar-annotate').click();
    cy.get('#navbar-annotate-videos').click();
    cy.wait('@getVideos');
  });

  it('Find and open specific video', () => {
    cy.server();
    cy.route('GET', '/api/videos').as('getVideos');

    cy.contains('Video List').click();
    cy.contains('Annotated Videos').click();
    cy.get('#video-41').click();
    cy.get('#close-video-list').click();
    cy.wait('@getVideos');
  });

  it('Draw box', () => {
    cy.get('#video')
      .trigger('mousedown', { clientX: 100, clientY: 100 })
      .trigger('mousemove', { clientX: 200, clientY: 200 })
      .trigger('mouseup');
  });

  it('Select concept and submit', () => {
    cy.server();
    cy.route('GET', '/api/concepts').as('getConcepts');
    cy.route('POST', '/api/annotations').as('postAnnotation');

    cy.get('#concepts-selected').click();
    cy.get('#concepts-add').click();
    cy.wait('@getConcepts');
    cy.get('#search-concepts').type('Unknown{enter}');
    cy.get('#Unknown').click();
    cy.get('#dialog-input').type('Cypress test - delete later');
    cy.get('#submit').click();
    cy.wait('@postAnnotation');
  });

  it('Go to report page', () => {
    expect(localStorage.getItem('username')).to.eq('test123');
    cy.visit('/');
    cy.get('#navbar-report').click();
    cy.get('button')
      .contains('Open Report Selector')
      .should('be.visible');
  });

  it('Check if in report selector', () => {
    cy.get('#selector-button').click();
    cy.get('#Level-1').select('Video');
    cy.get('#Level-2').select('Concept');
    cy.get('#ok-button').click();
    cy.contains('41:')
      .should('be.visible')
      .click();
    cy.contains('Unknown')
      .should('be.visible')
      .click();
    cy.contains('Annotated: Unknown').click();
  });

  it('Delete annotation and logout', () => {
    cy.server();
    cy.route('DELETE', '/api/annotations').as('deleteAnnotation');

    cy.get('#delete').click();
    cy.wait('@deleteAnnotation');
    cy.visit('/');
    cy.contains('Logout').click();
  });
});