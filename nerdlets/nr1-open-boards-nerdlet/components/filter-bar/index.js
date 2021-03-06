/* eslint 
no-console: 0
*/
import React from 'react';
import { DataConsumer } from '../../context/data';
import Filter from './filter';
import { buildFilterClause } from '../chart-grid/utils';

const getFilterData = widgets => {
  let eventTypes = '';
  let accounts = [];

  widgets.forEach(w => {
    (w.sources || []).forEach(s => {
      if (s.nrqlQuery) {
        accounts = [...accounts, ...s.accounts];
        const regex = /FROM (\S+)/;
        const found = s.nrqlQuery.match(regex);
        if (found) {
          eventTypes += `${found[1]},`;
        }
      }
    });
  });

  eventTypes = eventTypes.split(',') || [];
  eventTypes = [...new Set(eventTypes)].filter(e => e);
  accounts = [...new Set(accounts)];

  return { eventTypes, accounts };
};

export default class FilterBar extends React.PureComponent {
  render() {
    return (
      <DataConsumer>
        {({ selectedBoard, filters }) => {
          if (selectedBoard) {
            const dashboardFilters = selectedBoard.document.filters || [];
            const widgets = selectedBoard.document.widgets || [];
            const { eventTypes, accounts } = getFilterData(widgets);
            const whereClause = buildFilterClause(filters, dashboardFilters);

            return (
              <div
                className="filters-container"
                style={{
                  paddingLeft: '16px',
                  textAlign: 'left',
                  height: '55px',
                  display: selectedBoard ? '' : 'none'
                }}
              >
                {/* <h4 className="filters-header">Filters:</h4> */}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row'
                  }}
                >
                  {dashboardFilters.map((f, i) => (
                    <Filter
                      key={i}
                      filter={f}
                      filters={filters}
                      eventTypes={eventTypes}
                      accounts={accounts}
                      whereClause={whereClause}
                    />
                  ))}
                </div>
              </div>
            );
          } else {
            return '';
          }
        }}
      </DataConsumer>
    );
  }
}
