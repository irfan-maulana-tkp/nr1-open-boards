import gql from 'graphql-tag';

export const requiredFiltersSet = (filters, dbFilters) => {
  const requiredFilters = dbFilters.filter(f => f.required);

  if (!requiredFilters.length) {
    return true;
  }

  if (requiredFilters.length > filters.length) {
    return false;
  }

  let allSet = true;
  requiredFilters.forEach(rf => {
    let isSet = false;
    Object.keys(filters).forEach(f => {
      if (isSet) return;
      const filterName = f.replace('filter_', '');
      isSet = (rf.name === filterName) & (filters[f].value !== '*');
    });
    allSet = allSet & isSet;
  });

  return allSet;
};

export const buildFilterClause = (filters, dbFilters) => {
  if (Object.keys(filters).length > 0) {
    let value = '';
    Object.keys(filters).forEach(f => {
      const filterName = f.replace('filter_', '');
      if (filters[f] && filters[f].value !== '*') {
        const filterValue = filters[f].value;
        const whereValue = isNaN(filterValue)
          ? `'${filterValue}'`
          : filterValue;
        // const endValue =
        //   Object.keys(filters).length === 1 ||
        //   Object.keys(filters).length === i + 1
        //     ? ''
        //     : 'AND';

        let operator = '';
        for (let z = 0; z < dbFilters.length; z++) {
          if (dbFilters[z].name === filterName) {
            operator = dbFilters[z].operator || '';
            break;
          }
        }

        if (operator === '') {
          operator = whereValue.includes('%') ? ' LIKE ' : '=';
        }

        // auto adjust operatorif percent wildcard is
        if (whereValue.includes('%')) {
          operator = 'LIKE';
        }

        const filterNames = filterName.split(',');

        let multiWhere = ' WHERE';
        filterNames.forEach((name, i) => {
          multiWhere += ` \`${name}\` ${operator} ${whereValue}`;
          if (i + 1 < filterNames.length) {
            multiWhere += ' OR';
          }
        });
        value += multiWhere;
      }
    });
    return value !== 'WHERE ' ? value : '';
  } else if (dbFilters.length > 0) {
    let value = '';
    for (let z = 0; z < dbFilters.length; z++) {
      const filterName = dbFilters[z].name;
      const filterValue = dbFilters[z].default;

      if (filterValue !== '*') {
        const whereValue = isNaN(filterValue)
          ? `'${filterValue}'`
          : filterValue;

        // const endValue =
        //   dbFilters.length === 1 || dbFilters.length === z + 1 ? '' : 'AND';
        let operator = '';
        if (dbFilters[z].operator) {
          operator = dbFilters[z].operator;
        } else {
          operator = whereValue.includes('%') ? ' LIKE ' : '=';
        }

        // auto adjust operatorif percent wildcard is
        if (whereValue.includes('%')) {
          operator = 'LIKE';
        }

        const filterNames = filterName.split(',');

        let multiWhere = ' WHERE';
        filterNames.forEach((name, i) => {
          multiWhere += ` \`${name}\` ${operator} ${whereValue}`;
          if (i + 1 < filterNames.length) {
            multiWhere += ' OR';
          }
        });
        value += multiWhere;
      }
    }

    return value !== 'WHERE ' ? value : '';
  }

  return '';
};

export const writeStyle = (styleName, cssText) => {
  let styleElement = document.getElementById(styleName);
  if (styleElement)
    document.getElementsByTagName('head')[0].removeChild(styleElement);
  styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.id = styleName;
  styleElement.innerHTML = cssText;
  document.getElementsByTagName('head')[0].appendChild(styleElement);
};

export const stripQueryTime = nrqlQuery => {
  nrqlQuery = nrqlQuery
    .replace(/(SINCE|since) \d+\s+\w+\s+ago+/, '')
    .replace(/(UNTIL|until) \d+\s+\w+\s+ago+/, '')
    .replace(/(SINCE|since) \d+/, '')
    .replace(/(UNTIL|until) \d+/, '');

  const restricted = [
    'today',
    'yesterday',
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'last week',
    'this quarter'
  ];

  restricted.forEach(r => {
    nrqlQuery = nrqlQuery.replace(r, '').replace(r.toUpperCase(), '');
  });

  return nrqlQuery;
};

export const deriveAccounts = doc => {
  const foundAccounts = (doc.widgets || [])
    .map(w => w.sources || [])
    .flat()
    .map(s => s.accounts || [])
    .flat();

  return [...new Set(foundAccounts)];
};

export const deriveEvents = (
  events,
  nrqlEventData,
  entitySearchEventData,
  begin_time
) => {
  let newEventData = [];
  const selectedNrqlEvents = [];
  const selectedEntitySearchEvents = [];

  events.forEach(e => {
    if (nrqlEventData && e in nrqlEventData) {
      selectedNrqlEvents.push(nrqlEventData[e]);
    }
    if (entitySearchEventData && e in entitySearchEventData) {
      selectedEntitySearchEvents.push(entitySearchEventData[e]);
    }
  });

  selectedNrqlEvents.forEach(nrql => {
    nrql.forEach(n => {
      const formattedEvents = {
        metadata: {
          id: `events_${n.name}`,
          name: n.name.replace(/Kubernetes/g, 'K8s'),
          color: n.color || '#000000',
          viz: 'event'
        },
        data: n.data.map(d => ({
          x0: d.timestamp,
          x1: d.timestamp + 1
        }))
      };

      newEventData = [...newEventData, formattedEvents];
    });
  });

  selectedEntitySearchEvents.forEach(e => {
    e.forEach(entity => {
      entity.forEach(r => {
        if ((r.alertViolations || []).length > 0) {
          const warningAlerts = r.alertViolations.filter(
            a => a.alertSeverity === 'WARNING' && a.openedAt >= begin_time
          );
          const criticalAlerts = r.alertViolations.filter(
            a => a.alertSeverity === 'CRITICAL' && a.openedAt >= begin_time
          );

          const warningEvents = {
            metadata: {
              id: 'axis-marker-warning',
              axisMarkersType: 'alert',
              name: `Warning ${r.name}`,
              color: r.color || 'orange',
              viz: 'event'
            },
            data: warningAlerts.map(d => ({
              x0: d.openedAt,
              x1: d.openedAt + 1
            }))
          };

          const criticalEvents = {
            metadata: {
              id: 'axis-marker-critical',
              axisMarkersType: 'alert',
              name: `Critical ${r.name}`,
              color: r.color || 'red',
              viz: 'event'
            },
            data: criticalAlerts.map(d => ({
              x0: d.openedAt,
              x1: d.openedAt + 1
            }))
          };

          newEventData = [...newEventData, warningEvents, criticalEvents];
        }

        if ((r.deployments || []).length > 0) {
          const deployEvents = {
            metadata: {
              id: 'axis-marker-deployment',
              axisMarkersType: 'alert',
              name: `Deploy: ${r.name}`,
              color: r.color || '#000000',
              viz: 'event'
            },
            data: r.deployments.map(d => ({
              x0: d.timestamp,
              x1: d.timestamp + 1
            }))
          };
          newEventData = [...newEventData, deployEvents];
        }
      });
    });
  });

  return newEventData;
};

export const getGuidsQuery = (query, cursor) => gql`{
  actor {
    entitySearch(query: "${query}") {
      results${cursor ? `(cursor: "${cursor}")` : ''} {
        entities {
          guid
          name
        }
        nextCursor
      }
    }
  }
}`;

export const getAlertsDeploysQuery = (guids, endTime, startTime) => gql`{
  actor {
    entities(guids: [${guids}]) {
      name
      guid
      domain
      ... on AlertableEntity {
        alertSeverity
        alertViolations(endTime: ${endTime}, startTime: ${startTime}) {
          openedAt
          violationId
          violationUrl
          level
          label
          closedAt
          alertSeverity
          agentUrl
        }
      }
      ... on ApmApplicationEntity {
        deployments(timeWindow: {endTime: ${endTime}, startTime: ${startTime}}) {
          changelog
          description
          permalink
          revision
          timestamp
          user
        }
      }
      account {
        id
        name
      }
      entityType
    }
  }
}`;
