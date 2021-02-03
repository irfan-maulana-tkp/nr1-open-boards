import React from 'react';
import { Modal, Label, Form, Divider, Header, Checkbox, Button, Message } from 'semantic-ui-react';
import { writeUserDocument, writeAccountDocument } from '../../../lib/utils';
import { DataConsumer } from '../../../context/data';

export default class ManageBoardConfig extends React.Component {
    constructor(props) { 
        super(props);
        this.state = {
            autoSize: true,
            width: 0,
            height: 0
        }
    }

    componentDidMount() {
        const { boardConfig } = this.props;
        this.setState(boardConfig);
    }

    update = (selectedBoard, updateBoard, updateDataStateContext) => {
        selectedBoard.config = {...selectedBoard.config, ...this.state};
        return updateBoard(selectedBoard)
            .then(() => updateDataStateContext({ boardConfig: false }));
    };

    render() {
        return (
            <DataConsumer>
                {({
                    boardConfig,
                    updateBoard,
                    selectedBoard,
                    updateDataStateContext
                }) => {
                    const { autoSize, height, width } = this.state;
                    return (
                        <Modal
                          dimmer="inverted"
                          closeIcon
                          open={boardConfig}
                          onUnmount={() => updateDataStateContext({ closeCharts: false })}
                          onMount={() => updateDataStateContext({ closeCharts: true })}
                          onClose={() => updateDataStateContext({ boardConfig: false })}
                          size="fullscreen"
                        >
                            <Modal.Header>Update Board</Modal.Header>
                            <Modal.Content>
                                <Form>
                                <Header>Size</Header>
                                <Checkbox
                                    label="Auto"
                                    checked={autoSize}
                                    onChange={(e => this.setState({ autoSize: !autoSize }))}
                                />
                                <Form.Group>
                                    <Form.Input
                                        disabled={autoSize}
                                        label="Height (px)"
                                        onChange={e => this.setState({ height: parseFloat(e.target.value) })}
                                        value={height}
                                        type='number'
                                        fluid
                                        placeholder="Height..."
                                        min={0}
                                    />
                                    <Form.Input
                                        disabled={autoSize}
                                        label="Width (px)"
                                        onChange={e => this.setState({ width: parseFloat(e.target.value) })}
                                        value={width}
                                        type='number'
                                        fluid
                                        placeholder="Width..."
                                        min={0}
                                    />
                                </Form.Group>

                                </Form>
                            </Modal.Content>
                            <Modal.Actions>
                                <Button
                                    positive
                                    onClick={() => this.update(selectedBoard, updateBoard, updateDataStateContext)}
                                    >
                                Update
                                </Button>
                            </Modal.Actions>
                        </Modal>
                    )
                }}
            </DataConsumer>
        )
    }
}
