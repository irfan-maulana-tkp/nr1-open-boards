import React from 'react';
import { AutoSizer, NerdGraphQuery } from 'nr1';
import EntityHdvWidgetDropDown from './drop-down';
import gql from 'graphql-tag';
import EntityHdvWidget from './hdv';
import { chunk } from '../../../lib/helper';
import queue from 'async/queue';
import EntityHdvSummary from './summary';

import styled, { keyframes } from 'styled-components';
import { fadeIn, bounce } from 'react-animations';

const fadeInAnimation = keyframes`${fadeIn}`;

const FadeyDiv = styled.div`
  animation: 5s ${fadeInAnimation};
`;


const entityQuery = (query, cursor) => {
  return gql`{
    actor {
      entitySearch(query: "${query}") {
        results${cursor ? `(cursor: "${cursor}")` : ''} {
          entities {
            name
            guid
            account {
              id
              name
            }
            domain
            type
            entityType
            reporting
            ... on AlertableEntityOutline {
              alertSeverity
            }
          }
          nextCursor
        }
      }
    }
  }`;
};

const relationshipQuery = (guids, end_time) => {
  return gql`{
    actor {
      entities(guids: [${guids}]) {
        account {
          id
          name
        }
        guid
        name
        relationships(endTime: ${end_time})  {
          source {
            entity {
              name
              guid
              entityType
              type
              ... on AlertableEntityOutline {
                alertSeverity
              }
            }
          }
          target {
            entity {
              name
              guid
              entityType
              type
              ... on AlertableEntityOutline {
                alertSeverity
              }
            }
          }
        }
      }
    }
  }`;
};

const alertLevels = {
  UNCONFIGURED: 0,
  NOT_ALERTING: 1,
  WARNING: 2,
  CRITICAL: 3
};

const deriveHealthStatus = data => {
  let currentSeverity = 0;
  let currentStatus = 'UNCONFIGURED';
  data.forEach(entity => {
    const alertSeverity = alertLevels[entity.alertSeverity] || 0;

    if (alertSeverity > currentSeverity) {
      currentSeverity = alertSeverity;
      currentStatus = entity.alertSeverity;
    }
  });

  return currentStatus;
};

export default class EntityHdv extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      summarizedHealthStatus: 'UNCONFIGURED',
      relationshipData: {},
      showSummary: true,
      isFetching: false,
      error: false,
      tagFilterQuery: '',
      end_time: 4500000
    };
  }

  componentDidMount() {
    const { widget, tagFilterQuery, end_time } = this.props;
    // fetch data on poll
    let pollInterval = widget.ms || 30000;
    pollInterval = pollInterval < 15000 ? 15000 : pollInterval;

    // fetch data on mount
    this.setState(
      {
        init: true,
        query: widget.value,
        tagFilterQuery,
        pollInterval,
        end_time
      },
      () => {
        this.fetchData();

        this.widgetPoll = setInterval(() => {
          this.fetchData();
        }, pollInterval);
      }
    );
  }

  componentDidUpdate() {
    const { widget, tagFilterQuery, end_time } = this.props;

    if (
      widget.value !== this.state.query ||
      tagFilterQuery !== this.state.tagFilterQuery ||
      end_time !== this.state.end_time
    ) {
      this.updateFilter(widget, tagFilterQuery, end_time);
    }
  }

  componentWillUnmount() {
    if (this.widgetPoll) {
      clearInterval(this.widgetPoll);
    }
  }

  toggleSummary = () => {
    const { showSummary } = this.state;
    this.setState({ showSummary: !showSummary });
  };

  updateFilter = (widget, tagFilterQuery, end_time) => {
    const stateUpdate = {
      init: false,
      query: widget.value,
      tagFilterQuery,
      end_time,
      showSummary: true
    };
    this.setState(stateUpdate, () => {
      const { pollInterval } = this.state;

      if (this.widgetPoll) {
        clearInterval(this.widgetPoll);
      }

      this.fetchData();

      this.widgetPoll = setInterval(() => {
        this.fetchData();
      }, pollInterval);
    });
  };

  fetchData = () => {
    const { isFetching, end_time } = this.state;

    if (!isFetching) {
      this.setState({ isFetching: true }, () => {
        this.recursiveEntityFetch().then(data => {
          // this.setState({ data, isFetching: false });
          this.setState({ data }, async () => {
            const entityGuids = data.map(e => e.guid);
            const entityChunks = chunk(entityGuids, 25);
            const summarizedHealthStatus = deriveHealthStatus(data);

            const entityPromises = entityChunks.map(chunk => {
              return new Promise(async resolve => {
                const guids = `"${chunk.join(`","`)}"`;
                const nerdGraphResult = await NerdGraphQuery.query({
                  query: relationshipQuery(guids, end_time)
                });
                resolve(nerdGraphResult);
              });
            });

            let relationships = [];
            await Promise.all(entityPromises).then(values => {
              values.forEach(v => {
                const entities =
                  (((v || {}).data || {}).actor || {}).entities || [];
                relationships = [...relationships, ...entities];
              });
            });
            const relationshipData = {};
            relationships.forEach(r => {
              relationshipData[r.guid] = { ...r };
            });

            this.setState({
              relationshipData,
              summarizedHealthStatus,
              isFetching: false
            });
          });
        });
      });
    }
  };

  recursiveEntityFetch = async () => {
    const { query, tagFilterQuery } = this.state;

    return new Promise(async resolve => {
      const guidData = [];

      const q = queue((task, callback) => {
        NerdGraphQuery.query({
          query: entityQuery(
            `${task.query} ${task.tagFilterQuery || ''}`,
            task.cursor
          )
        }).then(value => {
          const results =
            ((((value || {}).data || {}).actor || {}).entitySearch || {})
              .results || null;

          if (results) {
            if (results.entities.length > 0) {
              guidData.push(results.entities);
            }

            if (results.nextCursor) {
              q.push({ query, tagFilterQuery, cursor: results.nextCursor });
            }
          }

          callback();
        });
      }, 1);

      q.push({ query, tagFilterQuery, cursor: null });

      await q.drain();

      resolve(guidData.flat());
    });
  };

  render() {
    const {
      data,
      isFetching,
      relationshipData,
      showSummary,
      summarizedHealthStatus
    } = this.state;
    const { widget, i } = this.props;
    const hdrStyle = widget.headerStyle || {};

    return (
        <div style={{ width: '100%', height: '100%' }}>
          <AutoSizer>
            {({ width, height }) => {
              const headerHeight = hdrStyle.height
                ? hdrStyle.height.replace(/\D/g, '')
                : 30;

              const maxWidgetHeight = height - headerHeight;
              const paddingTop = '5px';
              const paddingLeft = '9px';
              const paddingRight = '5px';
              const paddingBottom = '5px';

              hdrStyle.fontSize = hdrStyle.fontSize || '14px';
              hdrStyle.fontWeight = hdrStyle.fontWeight || 'bold';
              // hdrStyle.fontFamily = hdrStyle.fontFamily || 'Fira Code';
              hdrStyle.paddingLeft = hdrStyle.paddingLeft || '9px';
              hdrStyle.paddingLeft = hdrStyle.paddingRight || '5px';
              hdrStyle.float = hdrStyle.float || 'left';
              hdrStyle.verticalAlign = hdrStyle.verticalAlign || 'middle';

              return (
                <div style={{ paddingTop }}>
                  <div style={{ height: `${headerHeight}px` }}>
                    <div
                      style={{
                        ...hdrStyle
                      }}
                    >
                      {widget.name || 'some widget'}
                    </div>

                    <div
                      style={{
                        float: 'right',
                        maxHeight: `${headerHeight}px`
                      }}
                    >
                      <EntityHdvWidgetDropDown
                        i={i}
                        height={`${headerHeight}px`}
                      />
                    </div>
                  </div>

                  <FadeyDiv>
                    <div
                      style={{
                        paddingLeft,
                        paddingRight,
                        paddingBottom,
                        overflowX: 'hidden'
                      }}
                    >
                      {showSummary && widget.summarize === 'true' ? (
                        <EntityHdvSummary
                          width={width}
                          height={maxWidgetHeight - 5}
                          summarizedHealthStatus={summarizedHealthStatus}
                          toggleSummary={this.toggleSummary}
                          isFetching={isFetching}
                          summaryLabel={widget.summaryLabel}
                          summaryLabelFontSize={widget.summaryLabelFontSize}
                        />
                      ) : (
                        <EntityHdvWidget
                          summarize={widget.summarize}
                          toggleSummary={this.toggleSummary}
                          data={data}
                          width={width}
                          height={maxWidgetHeight}
                          limit={widget.limit}
                          isFetching={isFetching}
                          relationshipData={relationshipData}
                        />
                      )}
                    </div>
                  </FadeyDiv>
                </div>
              );
            }}
          </AutoSizer>
        </div>
    );
  }
}
